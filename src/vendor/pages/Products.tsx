import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAction } from '@/hooks/useAction'
import { useAsync } from '@/hooks/useAsync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { pageParam, useSearchParamInput, useUrlParams } from '@/hooks/useUrlState'
import { errorMessage } from '@/lib/api'
import { downloadBlob } from '@/lib/csv'
import { formatCedis } from '@/lib/format'
import { deleteProduct, downloadProductTemplate, fetchCategories, fetchProducts, isReadOnly, MAX_UPLOAD_BYTES, productPhotoSrc, PRODUCTS_PER_PAGE, SheetRowsError, updateProduct, uploadProducts, type Category, type Product, type UploadResult } from '@/lib/vendorPortal'
import { FileButton } from '@/vendor/FileButton'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import list from './Products.module.css'
import { LockNotice, VendorPageHeader } from './VendorPageHeader'

export function Products() {
  usePageTitle('Products')
  const { shop } = useVendorPortal()
  const [params, update] = useUrlParams()
  const [search, setSearch, committedSearch] = useSearchParamInput(params, update)
  const page = pageParam(params)

  const load = useCallback(() => fetchProducts(page, committedSearch), [page, committedSearch])
  // Refetch the page after any change (toggle, delete, bulk upload).
  const products = useAsync(load, { live: true })
  const categories = useAsync(fetchCategories)
  if (!shop) return null

  const editable = !isReadOnly(shop.status)
  const total = products.status === 'success' ? products.data.meta.total : 0

  return (
    <>
      <VendorPageHeader
        title="Products"
        lead="What buyers can order from you on WhatsApp. Your first product in stock sends your shop for review."
      />
      {!editable && <LockNotice status={shop.status} what="your products" />}

      {editable && (
        <div className={list.addRow}>
          <Link className={styles.primary} to="/vendor/products/new">
            Add a product
          </Link>
        </div>
      )}

      <section className={styles.card} aria-labelledby="your-products">
        <div className={list.listHeader}>
          <h2 id="your-products" className={styles.cardTitle}>
            Your products
          </h2>
          {products.status === 'success' && <span className={styles.muted}>{total} in total</span>}
        </div>
        <input
          className={styles.input}
          type="search"
          placeholder="Search by name"
          aria-label="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {products.status === 'loading' && <p className={styles.centered}>Loading…</p>}
        {products.status === 'error' && <p className={styles.alertError}>{products.error}</p>}
        {products.status === 'success' &&
          (products.data.data.length === 0 ? (
            <p className={styles.centered}>
              {committedSearch ? `No products match “${committedSearch}”.` : 'No products yet.'}
            </p>
          ) : (
            <ul className={list.items} aria-busy={products.isFetching}>
              {products.data.data.map((product) => (
                <ProductRow key={product.id} product={product} editable={editable} />
              ))}
            </ul>
          ))}

        {total > PRODUCTS_PER_PAGE && (
          <Pagination page={page} pageSize={PRODUCTS_PER_PAGE} total={total} onPageChange={(next) => update({ page: String(next) })} />
        )}
      </section>

      {editable && <BulkUpload categories={categories.status === 'success' ? categories.data : []} />}
    </>
  )
}

function ProductRow({ product, editable }: { product: Product; editable: boolean }) {
  const { pending, error, run } = useAction()

  /** Runs a change; the list refreshes itself afterwards (via the data-changed signal). */

  return (
    <li className={product.inStock ? list.item : list.itemOut}>
      <div className={list.itemMain}>
        {product.photoUrl && <img className={list.thumb} src={productPhotoSrc(product)!} alt="" loading="lazy" />}
        <div className={list.itemText}>
          <span className={list.itemName}>{product.name}</span>
          <span className={list.itemMeta}>
            {product.category?.title ?? product.categoryId}
            {!product.inStock && ' · Out of stock'}
          </span>
          <ul className={list.prices}>
            {product.measures.length ? (
              product.measures.map((m) => (
                <li key={m.code}>
                  {m.label} <strong>{formatCedis(m.price)}</strong>
                </li>
              ))
            ) : (
              <li>
                <strong>{formatCedis(product.price)}</strong>
              </li>
            )}
          </ul>
        </div>
      </div>

      {editable && (
        <div className={list.itemActions}>
          <label className={list.stockToggle}>
            <input
              type="checkbox"
              checked={product.inStock}
              disabled={pending}
              onChange={() => run(() => updateProduct(product.id, { inStock: !product.inStock }))}
            />
            In stock
          </label>
          <Link className={styles.textButton} to={`/vendor/products/${product.id}`}>
            Edit
          </Link>
          <button
            className={styles.dangerText}
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Delete “${product.name}”? Buyers won’t be able to order it.`)) void run(() => deleteProduct(product.id))
            }}
          >
            Delete
          </button>
        </div>
      )}
      {error && (
        <p className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </li>
  )
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string }
  | { kind: 'done'; fileName: string; result: UploadResult }
  | { kind: 'rows'; fileName: string; error: SheetRowsError }
  | { kind: 'error'; fileName: string; message: string }

function BulkUpload({ categories }: { categories: Category[] }) {
  const [categoryId, setCategoryId] = useState('')
  const [state, setState] = useState<UploadState>({ kind: 'idle' })
  const [templateError, setTemplateError] = useState<string | null>(null)

  async function handleTemplate() {
    setTemplateError(null)
    try {
      downloadBlob('marketix-products-template.xlsx', await downloadProductTemplate())
    } catch (err) {
      setTemplateError(errorMessage(err, 'Couldn’t download the template. Please try again.'))
    }
  }

  async function handleFile(file: File) {
    const fileName = file.name
    if (!/\.xlsx?$/i.test(fileName)) {
      setState({ kind: 'error', fileName, message: 'Upload an Excel file (.xlsx or .xls).' })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ kind: 'error', fileName, message: 'The file is over 5 MB. Split it into smaller files.' })
      return
    }
    setState({ kind: 'uploading', fileName })
    try {
      setState({ kind: 'done', fileName, result: await uploadProducts(file, categoryId || undefined) })
    } catch (err) {
      if (err instanceof SheetRowsError) setState({ kind: 'rows', fileName, error: err })
      else setState({ kind: 'error', fileName, message: errorMessage(err, 'Upload failed. Please try again.') })
    }
  }

  return (
    <section className={styles.card} aria-labelledby="bulk">
      <h2 id="bulk" className={styles.cardTitle}>
        Add many at once with Excel
      </h2>
      <ol className={list.howTo}>
        <li>
          <strong>Download the template</strong> and fill in one row per product. Up to 3 ways of selling each one (e.g.
          bowl, basket), each with its price.
        </li>
        <li>
          <strong>Use a category</strong> from the template’s Categories sheet.
        </li>
        <li>
          <strong>Upload the file.</strong> If any row has a problem, nothing is added and we show you which rows to fix.
        </li>
      </ol>

      <label className={styles.field}>
        <span>
          Category for rows that don’t have one <span className={styles.optional}>· optional</span>
        </span>
        <select className={styles.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">None — every row has a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <div className={list.buttons}>
        <button className={`${styles.secondary} ${styles.small}`} type="button" onClick={handleTemplate}>
          Download template
        </button>
        <FileButton
          primary
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          disabled={state.kind === 'uploading'}
          onPick={(file) => void handleFile(file)}
        >
          {state.kind === 'uploading' ? 'Uploading…' : 'Upload your file'}
        </FileButton>
      </div>
      {templateError && <p className={styles.alertError}>{templateError}</p>}

      <div aria-live="polite">
        {state.kind === 'done' && (
          <p className={styles.alertSuccess}>
            Added {state.result.created} {state.result.created === 1 ? 'product' : 'products'} from {state.fileName}.
          </p>
        )}
        {state.kind === 'error' && (
          <p className={styles.alertError}>
            <strong>{state.fileName}</strong>: {state.message}
          </p>
        )}
        {state.kind === 'rows' && (
          <div className={list.rowErrors}>
            <p className={styles.alertError}>{state.error.message}</p>
            <table className={list.errorTable}>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Problem</th>
                </tr>
              </thead>
              <tbody>
                {state.error.errors.map((e, index) => (
                  <tr key={`${e.row}-${index}`}>
                    <td>{e.row}</td>
                    <td>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
