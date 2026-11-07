import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary'
import { PageLoading } from '@/components/PageLoading/PageLoading'
import { RequireAuth } from '@/components/RequireAuth'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/context/auth-context'
import { homePathFor } from '@/lib/auth'

// Each page (and each layout) downloads only when it's first opened, so vendors never
// load the admin app and the first screen arrives sooner on a phone.
function page<M extends Record<K, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] })))
}

// Admin
const AdminLayout = page(() => import('@/layouts/AdminLayout/AdminLayout'), 'AdminLayout')
const AdminLogin = page(() => import('@/pages/AdminLogin/AdminLogin'), 'AdminLogin')
const AuditLog = page(() => import('@/pages/AuditLog/AuditLog'), 'AuditLog')
const NumberPool = page(() => import('@/pages/NumberPool/NumberPool'), 'NumberPool')
const Orders = page(() => import('@/pages/Orders/Orders'), 'Orders')
const Payouts = page(() => import('@/pages/Payouts/Payouts'), 'Payouts')
const ReviewQueue = page(() => import('@/pages/ReviewQueue/ReviewQueue'), 'ReviewQueue')
const VendorOrdersPage = page(() => import('@/pages/VendorOrders/VendorOrders'), 'VendorOrdersPage')
const VendorReviewPage = page(() => import('@/pages/VendorReview/VendorReview'), 'VendorReviewPage')
const Vendors = page(() => import('@/pages/Vendors/Vendors'), 'Vendors')

// Vendor
const VendorLayout = page(() => import('@/vendor/VendorLayout'), 'VendorLayout')
const Documents = page(() => import('@/vendor/pages/Documents'), 'Documents')
const Money = page(() => import('@/vendor/pages/Money'), 'Money')
const Promoters = page(() => import('@/vendor/pages/Promoters'), 'Promoters')
const NewOrder = page(() => import('@/vendor/pages/NewOrder'), 'NewOrder')
const OrderView = page(() => import('@/vendor/pages/OrderView'), 'OrderView')
const ProductEditor = page(() => import('@/vendor/pages/ProductEditor'), 'ProductEditor')
const Products = page(() => import('@/vendor/pages/Products'), 'Products')
const ShopDetails = page(() => import('@/vendor/pages/ShopDetails'), 'ShopDetails')
const VendorAuth = page(() => import('@/vendor/pages/VendorAuth'), 'VendorAuth')
const VendorHome = page(() => import('@/vendor/pages/VendorHome'), 'VendorHome')
const VendorOrdersList = page(() => import('@/vendor/pages/Orders'), 'Orders')

function App() {
  return (
    <ErrorBoundary fullPage>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading fullPage />}>
            <Routes>
              {/* Admin (MarketiX staff) */}
              <Route path="/login" element={<AdminLoginRoute />} />
              <Route element={<RequireAuth area="admin" />}>
                <Route element={<AdminLayout />}>
                  <Route path="review-queue" element={<ReviewQueue />} />
                  <Route path="vendors" element={<Vendors />} />
                  <Route path="vendors/:vendorId" element={<VendorReviewPage />} />
                  <Route path="whatsapp-numbers" element={<NumberPool />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/:vendorId" element={<VendorOrdersPage />} />
                  <Route path="audit-log" element={<AuditLog />} />
                  <Route path="payouts" element={<Payouts />} />
                </Route>
              </Route>

              {/* Vendor app */}
              <Route path="/vendor/signup" element={<VendorAuth mode="signup" />} />
              <Route path="/vendor/login" element={<VendorAuth mode="login" />} />
              <Route path="/vendor" element={<RequireAuth area="vendor" />}>
                <Route element={<VendorLayout />}>
                  <Route index element={<VendorHome />} />
                  <Route path="shop" element={<ShopDetails />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/new" element={<ProductEditor />} />
                  <Route path="products/:productId" element={<ProductEditor />} />
                  <Route path="orders" element={<VendorOrdersList />} />
                  <Route path="orders/new" element={<NewOrder />} />
                  <Route path="orders/:orderId" element={<OrderView />} />
                  <Route path="money" element={<Money />} />
                  <Route path="promoters" element={<Promoters />} />
                </Route>
              </Route>

              <Route path="*" element={<HomeRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

/** Sends users to their own home; logged-out visitors to the vendor sign-up. */
function HomeRedirect() {
  const { session } = useAuth()
  return <Navigate to={session ? homePathFor(session.user.role) : '/vendor/signup'} replace />
}

/** Admin login form, or a redirect for users who are already logged in. */
function AdminLoginRoute() {
  const { session, login } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from

  if (session) {
    const home = homePathFor(session.user.role)
    return <Navigate to={session.user.role === 'SUPER_ADMIN' && from ? from : home} replace />
  }
  return <AdminLogin onLogin={(credentials) => login(credentials, 'admin')} />
}

export default App
