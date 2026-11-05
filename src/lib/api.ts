import { notifyDataChanged } from './dataEvents'
import { clearSession, getAccessToken } from './session'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const FALLBACK_ERROR = 'Something went wrong. Please try again.'

export class ApiError extends Error {
  readonly status: number
  /** The parsed error body, for endpoints that send more than a message (e.g. row errors). */
  readonly body: unknown

  constructor(status: number, message: string, body: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** A 409: the action clashes with the current state (usually someone else acted first). */
export const isConflict = (err: unknown): err is ApiError => err instanceof ApiError && err.status === 409

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Sent as JSON, or as multipart when it is FormData (the browser sets that Content-Type). */
  body?: unknown
  /** Attach the stored access token as `Authorization: Bearer`. Defaults to true. */
  auth?: boolean
}

interface ErrorBody {
  message?: string | string[]
}

async function send(path: string, { method = 'GET', body, auth = true }: RequestOptions): Promise<Response> {
  const isForm = body instanceof FormData
  const headers = new Headers()
  if (body !== undefined && !isForm) headers.set('Content-Type', 'application/json')

  const token = auth ? getAccessToken() : null
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.")
  }

  if (!response.ok) {
    // An authenticated request was rejected: the token is invalid or expired.
    if (response.status === 401 && token) clearSession()

    const data: unknown = await response.json().catch(() => null)
    const message = (data as ErrorBody | null)?.message
    // Validation errors arrive as one message per problem.
    const text = Array.isArray(message) ? message.join('. ') : message
    throw new ApiError(response.status, text || FALLBACK_ERROR, data)
  }

  if (method !== 'GET') notifyDataChanged()
  return response
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  return (await response.json().catch(() => null)) as T
}

/** Downloads a protected file (it needs the token, so a plain link won't do). */
export async function apiBlob(path: string): Promise<Blob> {
  return (await send(path, {})).blob()
}

/** Like apiBlob, plus the file name from Content-Disposition (null if the server sends none). */
export async function apiDownload(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  const response = await send(path, {})
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return { blob: await response.blob(), fileName: match ? decodeURIComponent(match[1]) : null }
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
}

/**
 * A full URL for a path the API returns (e.g. "/api/v1/products/…/photo"). The path is
 * on the API's host, which in production may differ from this app's.
 */
export function apiUrl(path: string): string {
  return new URL(path, new URL(BASE_URL, window.location.origin)).href
}

/** A page of a paginated list endpoint. */
export interface ApiPage<T> {
  data: T[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

/** Builds a query string, leaving out empty values. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
