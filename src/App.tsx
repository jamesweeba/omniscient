import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { RequireAuth } from '@/components/RequireAuth'
import { AuthProvider } from '@/context/AuthProvider'
import { useAuth } from '@/context/auth-context'
import { AdminLayout } from '@/layouts/AdminLayout/AdminLayout'
import { homePathFor } from '@/lib/auth'
import { AdminLogin } from '@/pages/AdminLogin/AdminLogin'
import { AuditLog } from '@/pages/AuditLog/AuditLog'
import { NumberPool } from '@/pages/NumberPool/NumberPool'
import { Orders } from '@/pages/Orders/Orders'
import { ReviewQueue } from '@/pages/ReviewQueue/ReviewQueue'
import { VendorOrdersPage } from '@/pages/VendorOrders/VendorOrders'
import { VendorReviewPage } from '@/pages/VendorReview/VendorReview'
import { Vendors } from '@/pages/Vendors/Vendors'
import { Documents } from '@/vendor/pages/Documents'
import { NewOrder } from '@/vendor/pages/NewOrder'
import { Orders as VendorOrdersList } from '@/vendor/pages/Orders'
import { OrderView } from '@/vendor/pages/OrderView'
import { Money } from '@/vendor/pages/Money'
import { Payouts } from '@/pages/Payouts/Payouts'
import { ProductEditor } from '@/vendor/pages/ProductEditor'
import { Products } from '@/vendor/pages/Products'
import { ShopDetails } from '@/vendor/pages/ShopDetails'
import { VendorAuth } from '@/vendor/pages/VendorAuth'
import { VendorHome } from '@/vendor/pages/VendorHome'
import { VendorLayout } from '@/vendor/VendorLayout'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            </Route>
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
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
