import { MAX_UPLOAD_BYTES } from './vendorPortal'
/**
 * Shrinks a photo in the browser before upload (phone photos are often 3–6 MB; this makes
 * them a few hundred KB, which matters on mobile data). Returns a JPEG.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser can’t process photos. Please try another browser.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t process that photo. Please try another.'))),
      'image/jpeg',
      quality,
    ),
  )
}

/** "IMG_2041.HEIC" → "IMG_2041.jpg", for a photo converted to JPEG. */
export const asJpegName = (fileName: string) => `${fileName.replace(/\.[^.]+$/, '') || 'photo'}.jpg`

/** Image types the API takes as they are, when the browser can't convert a photo. */
export const UPLOADABLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * A file ready to upload: a photo shrunk to a JPEG of at most `maxSide` pixels, or the
 * original when the browser can't read it but the API takes its type (e.g. some HEIC
 * photos fail to convert). PDFs go as they are. Throws a message for the user when the
 * file can't be used or is over 5 MB. `what` names it in those messages ("photo").
 */
export async function prepareUpload(file: File, { maxSide, what }: { maxSide: number; what: string }): Promise<{ blob: Blob; name: string }> {
  let prepared: { blob: Blob; name: string } = { blob: file, name: file.name }
  if (file.type !== 'application/pdf') {
    try {
      prepared = { blob: await compressImage(file, maxSide), name: asJpegName(file.name) }
    } catch {
      if (!UPLOADABLE_IMAGE_TYPES.includes(file.type)) throw new Error(`We couldn’t read that ${what}. Please save it as a JPEG and try again.`)
    }
  }
  if (prepared.blob.size > MAX_UPLOAD_BYTES) throw new Error(`${what[0].toUpperCase()}${what.slice(1)}s must be 5 MB or smaller.`)
  return prepared
}
