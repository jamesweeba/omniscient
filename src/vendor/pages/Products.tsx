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
import {
  deleteProduct,
  downloadProductTemplate,
  fetchCategories,
  fetchProducts,
  isReadOnly,
  MAX_UPLOAD_BYTES,
  productPhotoSrc,
  PRODUCTS_PER_PAGE,
  SheetRowsError,
  updateProduct,
  uploadProducts,
  type Category,
  type Product,
  type UploadResult,
} from '@/lib/vendorPortal'
import { FileButton } from '@/vendor/FileButton'
import { useVendorPortal } from '../useVendorPortal'
import styles from '../vendor.module.css'
import panel from '../DataPanel.module.css'
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
        actions={
          editable && (
            <Link className={styles.primary} to="/vendor/products/new">
              <PlusIcon />
              Add product
            </Link>
          )
        }
      />
      {!editable && <LockNotice status={shop.status} what="your products" />}

      <div className={styles.columns}>
        <section className={panel.panel} aria-labelledby="your-products">
          <div className={panel.toolbar}>
            <h2 id="your-products" className={styles.cardTitle}>
              All products
              {products.status === 'success' && <span className={panel.count}>{total}</span>}
            </h2>
            <input
              className={`${styles.input} ${panel.search}`}
              type="search"
              placeholder="Search by name"
              aria-label="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {products.status === 'loading' && <p className={styles.centered}>Loading…</p>}
          {products.status === 'error' && <p className={`${styles.alertError} ${panel.inset}`}>{products.error}</p>}
          {products.status === 'success' &&
            (products.data.data.length === 0 ? (
              <p className={styles.centered}>
                {committedSearch ? `No products match “${committedSearch}”.` : 'No products yet. Add your first one to get started.'}
              </p>
            ) : (
              <table className={`${panel.table} ${list.table}`} aria-busy={products.isFetching}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Price</th>
                    <th scope="col">In stock</th>
                    <th scope="col">
                      <span className={styles.visuallyHiddenInline}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.data.data.map((product) => (
                    <ProductRow key={product.id} product={product} editable={editable} />
                  ))}
                </tbody>
              </table>
            ))}

          {total > PRODUCTS_PER_PAGE && (
            <div className={panel.footer}>
              <Pagination page={page} pageSize={PRODUCTS_PER_PAGE} total={total} onPageChange={(next) => update({ page: String(next) })} />
            </div>
          )}
        </section>

        {editable && <BulkUpload categories={categories.status === 'success' ? categories.data : []} />}
      </div>
    </>
  )
}

function ProductRow({ product, editable }: { product: Product; editable: boolean }) {
  const { pending, error, run } = useAction()
  const photo = productPhotoSrc(product)

  return (
    <tr className={product.inStock ? undefined : list.rowOut}>
      <td>
        <div className={list.productCell}>
          {photo ? (
            <img className={list.thumb} src={photo} alt="" loading="lazy" />
          ) : (
            <span className={list.thumbEmpty} aria-hidden="true">
              {product.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className={list.itemText}>
            {editable ? (
              <Link className={list.itemName} to={`/vendor/products/${product.id}`}>
                {product.name}
              </Link>
            ) : (
              <span className={list.itemName}>{product.name}</span>
            )}
            <span className={list.itemMeta}>{product.category?.title ?? product.categoryId}</span>
            {error && (
              <span className={styles.fieldError} role="alert">
                {error}
              </span>
            )}
          </span>
        </div>
      </td>
      <td className={list.priceCell}>
        {product.measures.length ? (
          <ul className={list.prices}>
            {product.measures.map((m) => (
              <li key={m.code}>
                <span>{m.label}</span> {formatCedis(m.price)}
              </li>
            ))}
          </ul>
        ) : (
          formatCedis(product.price)
        )}
      </td>
      <td className={list.stockCell}>
        <label className={list.switch}>
          <input
            type="checkbox"
            role="switch"
            checked={product.inStock}
            disabled={!editable || pending}
            onChange={() => run(() => updateProduct(product.id, { inStock: !product.inStock }))}
          />
          <span className={list.switchLabel}>{product.inStock ? 'In stock' : 'Out of stock'}</span>
        </label>
      </td>
      <td className={list.actionsCell}>
        {editable && (
          <>
            <Link className={`${styles.secondary} ${styles.small}`} to={`/vendor/products/${product.id}`}>
              Edit
            </Link>
            <button
              className={list.deleteButton}
              type="button"
              disabled={pending}
              aria-label={`Delete ${product.name}`}
              title="Delete"
              onClick={() => {
                if (window.confirm(`Delete “${product.name}”? Buyers won’t be able to order it.`)) void run(() => deleteProduct(product.id))
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </>
        )}
      </td>
    </tr>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
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
      setState({
        kind: 'error',
        fileName,
        message: 'Upload an Excel file (.xlsx or .xls).',
      })
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({
        kind: 'error',
        fileName,
        message: 'The file is over 5 MB. Split it into smaller files.',
      })
      return
    }
    setState({ kind: 'uploading', fileName })
    try {
      setState({
        kind: 'done',
        fileName,
        result: await uploadProducts(file, categoryId || undefined),
      })
    } catch (err) {
      if (err instanceof SheetRowsError) setState({ kind: 'rows', fileName, error: err })
      else
        setState({
          kind: 'error',
          fileName,
          message: errorMessage(err, 'Upload failed. Please try again.'),
        })
    }
  }

  return (
    <section className={styles.card} aria-labelledby="bulk">
      <h2 id="bulk" className={styles.cardTitle}>
        Import from Excel
      </h2>
      <p className={styles.muted}>Add many products at once from a spreadsheet.</p>
      <ol className={list.howTo}>
        <li>
          <strong>Download the template</strong> and fill in one row per product. Up to 3 ways of selling each one (e.g. bowl, basket), each with its price.
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
