import { useCallback, useState } from 'react'
import { Dialog } from '@/components/Dialog/Dialog'
import { SearchField } from '@/components/FilterControls/FilterControls'
import { FilterTabs } from '@/components/FilterTabs/FilterTabs'
import { Pagination } from '@/components/Pagination/Pagination'
import { useAsync } from '@/hooks/useAsync'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatCedis } from '@/lib/format'
import { productPhotoSrc, type Product } from '@/lib/vendorPortal'
import { fetchVendorProducts, type ProductStock, type VendorDetail } from '@/lib/vendors'
import { WarningIcon } from './DetailCards'
import styles from './VendorReview.module.css'

const PAGE_SIZE = 10

const STOCK_TABS: { key: ProductStock; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In stock' },
  { key: 'out', label: 'Out of stock' },
]

/** Every product the vendor added, with photos, so a reviewer sees what the shop will sell. */
export function ProductsCard({ vendor }: { vendor: VendorDetail }) {
  const [search, setSearch] = useState('')
  const [stock, setStock] = useState<ProductStock>('all')
  const [pageNumber, setPageNumber] = useState(1)
  const [enlarged, setEnlarged] = useState<Product | null>(null)
  const debouncedSearch = useDebouncedValue(search)

  const load = useCallback(
    () => fetchVendorProducts(vendor.id, { search: debouncedSearch, stock, page: pageNumber, pageSize: PAGE_SIZE }),
    [vendor.id, debouncedSearch, stock, pageNumber],
  )
  const products = useAsync(load)
  const data = products.status === 'success' ? products.data : null
  const { uncategorised } = vendor.products

  return (
    <section className={styles.card} aria-labelledby="products">
      <div className={styles.cardHeader}>
        <h2 id="products" className={styles.cardTitle}>
          Products{data ? ` · ${data.counts.all}` : ''}
        </h2>
        <SearchField
          label="Search products"
          placeholder="Search products"
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPageNumber(1)
          }}
        />
      </div>

      <FilterTabs
        label="Filter by stock"
        tabs={STOCK_TABS}
        active={stock}
        count={(t) => data?.counts[t.key]}
        onSelect={(key) => {
          setStock(key)
          setPageNumber(1)
        }}
      />

      {products.status === 'loading' && <p className={styles.mutedText}>Loading products…</p>}
      {products.status === 'error' && <p className={styles.errorText}>{products.error}</p>}
      {data &&
        (data.data.length === 0 ? (
          <p className={styles.mutedText}>
            {search.trim() || stock !== 'all' ? 'No products match.' : 'The vendor hasn’t added any products yet.'}
          </p>
        ) : (
          <>
            <div className={styles.tableScroll} aria-busy={products.isFetching}>
              <table className={styles.productTable}>
                <thead>
                  <tr>
                    <th>
                      <span className={styles.visuallyHidden}>Photo</span>
                    </th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Sold as</th>
                    <th className={styles.alignRight}>From</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((product) => (
                    <ProductRow key={product.id} product={product} onEnlarge={() => setEnlarged(product)} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pageNumber} pageSize={PAGE_SIZE} total={data.meta.total} onPageChange={setPageNumber} />
          </>
        ))}

      {uncategorised > 0 && (
        <div className={styles.notice} role="note">
          <WarningIcon />
          <span>
            {uncategorised} {uncategorised === 1 ? 'product has' : 'products have'} no category.
          </span>
        </div>
      )}

      {enlarged && (
        <Dialog title={enlarged.name} size="wide" onClose={() => setEnlarged(null)}>
          <img className={styles.productPhotoLarge} src={productPhotoSrc(enlarged)!} alt={enlarged.name} />
        </Dialog>
      )}
    </section>
  )
}

function ProductRow({ product, onEnlarge }: { product: Product; onEnlarge: () => void }) {
  const photo = productPhotoSrc(product)
  const prices = product.measures.length ? product.measures.map((m) => m.price) : [product.price]

  return (
    <tr>
      <td className={styles.photoCell}>
        {photo ? (
          <button className={styles.productThumbButton} type="button" onClick={onEnlarge} aria-label={`Enlarge photo of ${product.name}`}>
            <img className={styles.productThumb} src={photo} alt="" loading="lazy" />
          </button>
        ) : (
          <span className={styles.productThumbEmpty} title="No photo">
            —
          </span>
        )}
      </td>
      <td>
        <span className={styles.productName}>{product.name}</span>
        {!product.inStock && <span className={styles.outOfStock}> · out of stock</span>}
        {product.note && <span className={styles.productNote}>{product.note}</span>}
      </td>
      <td className={styles.mutedCell}>{product.category?.title ?? 'No category'}</td>
      <td className={styles.mutedCell}>
        {product.measures.length
          ? product.measures.map((m) => (
              <span key={m.code} className={styles.measureLine}>
                {m.label} {formatCedis(m.price)}
                {m.description && <span className={styles.measureNote}> · {m.description}</span>}
              </span>
            ))
          : 'Each'}
      </td>
      <td className={styles.alignRight}>{formatCedis(Math.min(...prices))}</td>
    </tr>
  )
}
