import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { BackLink } from '@/components/BackLink/BackLink'
import { CameraIcon } from '@/components/icons/CameraIcon'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { errorMessage } from '@/lib/api'
import { prepareUpload } from '@/lib/images'
import { createProduct, deleteProduct, fetchCategories, fetchProduct, isReadOnly, MAX_MEASURE_LABEL, MAX_MEASURES, productPhotoSrc, removeProductPhoto, updateProduct, uploadProductPhoto, type Category, type Measure, type Product, type ProductInput } from '@/lib/vendorPortal'
import { FileButton } from '@/vendor/FileButton'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import editor from './Products.module.css'
import { LockNotice } from './VendorPageHeader'

/** Add a product (/vendor/products/new) or edit one (/vendor/products/:productId). */
export function ProductEditor() {
  const { shop } = useVendorPortal()
  const { productId } = useParams()
  const loadProduct = useCallback(() => (productId ? fetchProduct(productId) : Promise.resolve(null)), [productId])
  const product = useAsync(loadProduct)
  const categories = useAsync(fetchCategories)
  usePageTitle(!productId ? 'New product' : product.status === 'success' && product.data ? product.data.name : 'Product')
  if (!shop) return null

  const error = product.status === 'error' ? product.error : categories.status === 'error' ? categories.error : null

  return (
    <>
      <BackLink to="/vendor/products">Products</BackLink>
      <div className={styles.heading}>
        <h1 className={styles.title}>{productId ? 'Edit product' : 'Add a product'}</h1>
      </div>
      {isReadOnly(shop.status) && <LockNotice status={shop.status} what="your products" />}

      {error && <p className={styles.alertError}>{error}</p>}
      {!error && (product.status === 'loading' || categories.status === 'loading') && <p className={styles.centered}>Loading…</p>}
      {product.status === 'success' && categories.status === 'success' && (
        <ProductForm key={productId ?? 'new'} saved={product.data} categories={categories.data} readOnly={isReadOnly(shop.status)} />
      )}
    </>
  )
}

/** One way the product is sold. `code` is kept for measures that already exist. */
interface Row {
  key: number
  code: string | null
  label: string
  price: string
  /** Shown under the option, e.g. "About 2 kg". */
  description: string
}

/** Common ways market goods are sold, offered as one-tap chips. */
const COMMON_MEASURES = ['Olonka', 'Half basket', 'Basket', 'Bag', 'Half bag', 'Bunch', 'Tin', 'Each']
const MAX_MEASURE_DESCRIPTION = 300

type Errors = Partial<Record<'name' | 'categoryId' | 'rows', string>>

/** The photo as it will be after saving. */
type PhotoChange = { kind: 'keep' } | { kind: 'new'; blob: Blob; name: string; preview: string } | { kind: 'remove' }

/** Router state when a new product saved but its photo didn't. */
interface EditorState {
  photoError?: string
}


/** Phones and tablets get a separate "Take photo" button that opens the camera. */
const hasCamera = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

let nextKey = 1
const newRow = (label = '', price = '', code: string | null = null, description = ''): Row => ({
  key: nextKey++,
  code,
  label,
  price,
  description,
})

function rowsFrom(product: Product | null): Row[] {
  if (!product) return [newRow()]
  if (product.measures.length === 0) return [newRow('', String(product.price))]
  return product.measures.map((m) => newRow(m.label, String(m.price), m.code, m.description ?? ''))
}

interface ProductFormProps {
  saved: Product | null
  categories: Category[]
  readOnly: boolean
}

function ProductForm({ saved, categories, readOnly }: ProductFormProps) {
  const navigate = useNavigate()
  const routeState = useLocation().state as EditorState | null
  const [name, setName] = useState(saved?.name ?? '')
  const [categoryId, setCategoryId] = useState(saved?.categoryId ?? '')
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(saved))
  const [inStock, setInStock] = useState(saved?.inStock ?? true)
  const [note, setNote] = useState(saved?.note ?? '')
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' })
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(routeState?.photoError ?? null)

  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  /** A single row without a label is a plain price; otherwise each row is a measure. */
  const simple = rows.length === 1 && !rows[0].label.trim()

  function buildInput(): ProductInput | null {
    const next: Errors = {}
    if (!name.trim()) next.name = 'Enter the product name.'
    if (!categoryId) next.categoryId = 'Choose a category.'

    const prices = rows.map((row) => Number(row.price))
    const labels = rows.map((row) => row.label.trim())
    if (rows.some((row, i) => row.price.trim() === '' || !Number.isFinite(prices[i]) || prices[i] < 0)) {
      next.rows = simple ? 'Enter a price.' : 'Every option needs a price of 0 or more.'
    } else if (!simple && labels.some((label) => !label)) {
      next.rows = 'Name every option, e.g. “Small bowl”, or remove the empty ones.'
    } else if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) {
      next.rows = 'Each option needs a different name.'
    }

    setErrors(next)
    if (Object.keys(next).length) return null

    const measures = simple ? [] : toMeasures(rows)
    return {
      name: name.trim(),
      categoryId,
      price: simple ? prices[0] : Math.min(...prices),
      measures,
      inStock,
      note: note.trim(),
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = buildInput()
    if (!input) {
      setError('Please fix the highlighted fields.')
      return
    }
    setPending(true)
    setError(null)
    let product: Product
    try {
      product = saved
        ? await updateProduct(saved.id, input)
        : await createProduct({ ...input, measures: input.measures?.length ? input.measures : undefined, note: input.note || undefined })
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
      return
    }

    // The photo goes up once the product exists (a new one needs its id first).
    try {
      if (photo.kind === 'new') await uploadProductPhoto(product.id, photo.blob, photo.name)
      else if (photo.kind === 'remove' && saved?.photoUrl) await removeProductPhoto(product.id)
    } catch (err) {
      const reason = errorMessage(err, 'Please try again.')
      if (saved) {
        setPhotoError(`Your changes are saved, but the photo didn’t upload. ${reason}`)
        setPending(false)
      } else {
        // Continue on the new product's edit page, so trying again can't add it twice.
        const state: EditorState = { photoError: `The product is saved, but the photo didn’t upload. ${reason} Choose it again.` }
        navigate(`/vendor/products/${product.id}`, { replace: true, state })
      }
      return
    }
    navigate('/vendor/products')
  }

  /** Shrinks a picked photo to a JPEG for slow connections, then holds it until Save. */
  async function pickPhoto(file: File) {
    setPhotoError(null)
    if (!file.type.startsWith('image/')) return setPhotoError('Choose a photo (JPEG, PNG or WebP).')
    setPhotoBusy(true)
    try {
      const { blob, name } = await prepareUpload(file, { maxSide: 1200, what: 'photo' })
      setPhoto({ kind: 'new', blob, name, preview: URL.createObjectURL(blob) })
    } catch (err) {
      setPhotoError(errorMessage(err, 'Couldn’t use that photo. Please try another.'))
    } finally {
      setPhotoBusy(false)
    }
  }

  // Free the preview of a picked photo once it is replaced or the form closes.
  useEffect(() => {
    if (photo.kind !== 'new') return
    return () => URL.revokeObjectURL(photo.preview)
  }, [photo])

  const photoSrc = photo.kind === 'new' ? photo.preview : photo.kind === 'remove' || !saved ? null : productPhotoSrc(saved)

  async function handleDelete() {
    if (!saved || !window.confirm(`Delete “${saved.name}”? Buyers won’t be able to order it.`)) return
    setPending(true)
    try {
      await deleteProduct(saved.id)
      navigate('/vendor/products')
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t delete it. Please try again.'))
      setPending(false)
    }
  }

  /** Wraps a setter so editing a field also clears its error. */
  const edit =
    (key: keyof Errors, setter: (value: string) => void) =>
    (value: string) => {
      setter(value)
      setErrors((current) => ({ ...current, [key]: undefined }))
      setError(null)
    }

  const usedLabels = new Set(rows.map((row) => row.label.trim().toLowerCase()))
  const unusedChips = COMMON_MEASURES.filter((label) => !usedLabels.has(label.toLowerCase()))

  /** A chip: names the plain-price row, or adds an option with that name. */
  function addMeasure(label: string) {
    setRows((current) =>
      current.length === 1 && !current[0].label.trim() ? [{ ...current[0], label }] : [...current, newRow(label)],
    )
    setErrors((current) => ({ ...current, rows: undefined }))
    setError(null)
  }

  const changeRow = (key: number, changes: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)))
    setErrors((current) => ({ ...current, rows: undefined }))
    setError(null)
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <fieldset className={styles.fieldset} disabled={readOnly || pending}>
        <label className={styles.field}>
          Product name
          <input className={errors.name ? styles.inputInvalid : styles.input} placeholder="Tomatoes" value={name} onChange={(e) => edit('name', setName)(e.target.value)} />
          {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
        </label>

        <label className={styles.field}>
          Category
          <select className={styles.select} value={categoryId} onChange={(e) => edit('categoryId', setCategoryId)(e.target.value)}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {errors.categoryId ? (
            <span className={styles.fieldError}>{errors.categoryId}</span>
          ) : (
            <span className={styles.fieldHint}>{categories.find((c) => c.id === categoryId)?.description}</span>
          )}
        </label>

        <div className={styles.field} role="group" aria-labelledby="sold-as">
          <span id="sold-as">{simple ? 'Price (GH₵)' : 'How you sell it'}</span>
          <span className={styles.fieldHint}>
            {simple
              ? 'Sold by the olonka, basket or bag? Tap one below and give each its price.'
              : `Buyers pick one. Names up to ${MAX_MEASURE_LABEL} characters, e.g. “Half basket”.`}
          </span>
          <div className={editor.measures}>
            {rows.map((row, index) => (
              <div key={row.key} className={editor.measureRow}>
                {!simple && (
                  <input
                    className={styles.input}
                    aria-label={`Option ${index + 1} name`}
                    maxLength={MAX_MEASURE_LABEL}
                    placeholder="Half basket"
                    value={row.label}
                    onChange={(e) => changeRow(row.key, { label: e.target.value })}
                  />
                )}
                <input
                  className={`${styles.input} ${editor.priceInput}`}
                  aria-label={simple ? 'Price in cedis' : `Option ${index + 1} price in cedis`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="GH₵"
                  value={row.price}
                  onChange={(e) => changeRow(row.key, { price: e.target.value })}
                />
                {!simple && (
                  <input
                    className={`${styles.input} ${editor.measureNote}`}
                    aria-label={`Option ${index + 1} note`}
                    maxLength={MAX_MEASURE_DESCRIPTION}
                    placeholder="Note, e.g. About 2 kg (optional)"
                    value={row.description}
                    onChange={(e) => changeRow(row.key, { description: e.target.value })}
                  />
                )}
                {!simple && (
                  <button
                    className={editor.removeRow}
                    type="button"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => setRows((current) => (current.length > 1 ? current.filter((r) => r.key !== row.key) : [newRow('', row.price)]))}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.rows && <span className={styles.fieldError}>{errors.rows}</span>}
          {rows.length < MAX_MEASURES && unusedChips.length > 0 && (
            <div className={editor.chips} role="group" aria-label="Add a common way of selling">
              {unusedChips.map((label) => (
                <button key={label} className={editor.chip} type="button" onClick={() => addMeasure(label)}>
                  + {label}
                </button>
              ))}
            </div>
          )}
          {rows.length < MAX_MEASURES && (
            <button
              className={styles.textButton}
              type="button"
              onClick={() => {
                // Turning a plain price into options: give the first option a name field too.
                setRows((current) => [...current, newRow()])
                if (simple) changeRow(rows[0].key, { label: 'Each' })
              }}
            >
              + {simple ? 'Sell it in different sizes' : 'Add another option'}
            </button>
          )}
        </div>

        <label className={styles.choice}>
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
          In stock — buyers can order it now
        </label>

        <label className={styles.field}>
          <span>
            Note <span className={styles.optional}>· optional</span>
          </span>
          <input className={styles.input} placeholder="Fresh from Techiman" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className={styles.field} role="group" aria-labelledby="photo-label">
          <span id="photo-label">
            Photo <span className={styles.optional}>· optional</span>
          </span>
          <div className={editor.photo}>
            <div className={editor.photoPreview}>
              {photoSrc ? <img src={photoSrc} alt="Product photo" /> : <CameraIcon size={28} />}
            </div>
            <div className={editor.photoActions}>
              {hasCamera && (
                <FileButton camera accept="image/*" onPick={pickPhoto}>
                  Take photo
                </FileButton>
              )}
              <FileButton accept="image/*" onPick={pickPhoto}>
                {photoBusy ? 'Preparing…' : photoSrc ? 'Choose another' : hasCamera ? 'Choose from phone' : 'Choose photo'}
              </FileButton>
              {photoSrc && (
                <button
                  className={styles.textButton}
                  type="button"
                  onClick={() => {
                    setPhoto(saved?.photoUrl ? { kind: 'remove' } : { kind: 'keep' })
                    setPhotoError(null)
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          {photoError ? (
            <span className={styles.fieldError} role="alert">
              {photoError}
            </span>
          ) : (
            <span className={styles.fieldHint}>
              {photo.kind === 'new' ? 'The photo is saved when you save the product.' : 'A clear photo, taken in good light.'}
            </span>
          )}
        </div>
      </fieldset>

      {error && (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      )}
      {!readOnly && (
        <div className={editor.formActions}>
          <button className={styles.primary} type="submit" disabled={pending}>
            {pending ? 'Saving…' : saved ? 'Save changes' : 'Add product'}
          </button>
          {saved && (
            <button className={styles.dangerText} type="button" disabled={pending} onClick={handleDelete}>
              Delete this product
            </button>
          )}
        </div>
      )}
    </form>
  )
}



/** Rows to API measures: existing codes are kept; new ones come from the label, made unique. */
function toMeasures(rows: Row[]): Measure[] {
  const used = new Set(rows.map((row) => row.code).filter((code) => code !== null))
  return rows.map((row) => {
    let code = row.code
    if (!code) {
      const base = row.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'option'
      code = ['remove', 'none'].includes(base) ? `${base}_1` : base
      for (let n = 2; used.has(code); n++) code = `${base}_${n}`
      used.add(code)
    }
    const description = row.description.trim()
    return { code, label: row.label.trim(), price: Number(row.price), ...(description ? { description } : {}) }
  })
}
