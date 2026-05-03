import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import DashboardView from '../views/DashboardView.vue'
import InstancesView from '../views/InstancesView.vue'
import InstanceDetailView from '../views/InstanceDetailView.vue'
import NewInstanceView from '../views/NewInstanceView.vue'
import CheckoutView from '../views/CheckoutView.vue'
import CryptoPaymentView from '../views/CryptoPaymentView.vue'
import EPayPaymentView from '../views/EPayPaymentView.vue'
import OrderPaymentStatusView from '../views/OrderPaymentStatusView.vue'
import InvoicesView from '../views/InvoicesView.vue'
import InvoiceDetailView from '../views/InvoiceDetailView.vue'
import CreateInvoiceView from '../views/CreateInvoiceView.vue'
import ProfileView from '../views/ProfileView.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import AdminNodesView from '../views/admin/AdminNodesView.vue'
import AdminNodeDetailView from '../views/admin/AdminNodeDetailView.vue'
import AdminCreateNodeView from '../views/admin/AdminCreateNodeView.vue'
import AdminProductsView from '../views/admin/AdminProductsView.vue'
import AdminCreateProductView from '../views/admin/AdminCreateProductView.vue'
import AdminProductDetailView from '../views/admin/AdminProductDetailView.vue'
import AdminResourcePoolsView from '../views/admin/AdminResourcePoolsView.vue'
import AdminCreateResourcePoolView from '../views/admin/AdminCreateResourcePoolView.vue'
import AdminResourcePoolDetailView from '../views/admin/AdminResourcePoolDetailView.vue'
import AdminPerformanceView from '../views/admin/AdminPerformanceView.vue'
import AdminPaymentProvidersView from '../views/admin/AdminPaymentProvidersView.vue'
import AdminCreatePaymentProviderView from '../views/admin/AdminCreatePaymentProviderView.vue'
import AdminEditPaymentProviderView from '../views/admin/AdminEditPaymentProviderView.vue'
import AdminCouponsView from '../views/admin/AdminCouponsView.vue'
import AdminGeneralSettingsView from '../views/admin/AdminGeneralSettingsView.vue'
import AdminSMTPSettingsView from '../views/admin/AdminSMTPSettingsView.vue'
import { getToken, getRole } from '../api/auth'

function paymentStatusRedirect(result) {
  return (to) => ({
    name: 'payment-result',
    params: { id: to.params.id },
    query: { ...to.query, result }
  })
}

function legacyPaymentStatusRedirect(to) {
  return {
    name: 'payment-result',
    params: { id: to.params.id },
    query: to.query
  }
}

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
  { path: '/register', name: 'register', component: RegisterView, meta: { guest: true } },
  { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView, meta: { guest: true } },
  { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { auth: true } },
  { path: '/instances', name: 'instances', component: InstancesView, meta: { auth: true } },
  { path: '/instances/new', name: 'new-instance', component: NewInstanceView, meta: { auth: true } },
  { path: '/instances/:id', name: 'instance-detail', component: InstanceDetailView, meta: { auth: true } },
  { path: '/orders/:id/checkout', name: 'checkout', component: CheckoutView, meta: { auth: true } },
  { path: '/orders/:id/pay', name: 'crypto-payment', component: CryptoPaymentView, meta: { auth: true } },
  { path: '/orders/:id/pay/epay', name: 'epay-payment', component: EPayPaymentView, meta: { auth: true } },
  { path: '/payment/result/:id', name: 'payment-result', component: OrderPaymentStatusView, meta: { auth: true } },
  { path: '/orders/:id/payments/status', redirect: legacyPaymentStatusRedirect, meta: { auth: true } },
  { path: '/orders/:id/status', redirect: legacyPaymentStatusRedirect, meta: { auth: true } },
  { path: '/orders/:id/payment/success', name: 'payment-success', redirect: paymentStatusRedirect('success'), meta: { auth: true } },
  { path: '/orders/:id/payment/cancel', name: 'payment-cancel', redirect: paymentStatusRedirect('cancelled'), meta: { auth: true } },
  { path: '/orders/:id/payment/failed', name: 'payment-failed', redirect: paymentStatusRedirect('failed'), meta: { auth: true } },

  // Profile route
  { path: '/profile', name: 'profile', component: ProfileView, meta: { auth: true } },

  // Invoice routes
  { path: '/invoices', name: 'invoices', component: InvoicesView, meta: { auth: true } },
  { path: '/invoices/create', name: 'create-invoice', component: CreateInvoiceView, meta: { auth: true, admin: true } },
  { path: '/invoices/:id', name: 'invoice-detail', component: InvoiceDetailView, meta: { auth: true } },

  // Admin routes
  { path: '/admin', name: 'admin-dashboard', component: AdminDashboardView, meta: { auth: true, admin: true } },
  { path: '/admin/nodes', name: 'admin-nodes', component: AdminNodesView, meta: { auth: true, admin: true } },
  { path: '/admin/nodes/new', name: 'admin-create-node', component: AdminCreateNodeView, meta: { auth: true, admin: true } },
  { path: '/admin/nodes/:id', name: 'admin-node-detail', component: AdminNodeDetailView, meta: { auth: true, admin: true } },

  // Admin product routes
  { path: '/admin/products', name: 'admin-products', component: AdminProductsView, meta: { auth: true, admin: true } },
  { path: '/admin/products/new', name: 'admin-create-product', component: AdminCreateProductView, meta: { auth: true, admin: true } },
  { path: '/admin/products/:id', name: 'admin-product-detail', component: AdminProductDetailView, meta: { auth: true, admin: true } },

  // Admin resource pool routes
  { path: '/admin/resource-pools', name: 'admin-resource-pools', component: AdminResourcePoolsView, meta: { auth: true, admin: true } },
  { path: '/admin/resource-pools/new', name: 'admin-create-resource-pool', component: AdminCreateResourcePoolView, meta: { auth: true, admin: true } },
  { path: '/admin/resource-pools/:id', name: 'admin-resource-pool-detail', component: AdminResourcePoolDetailView, meta: { auth: true, admin: true } },

  // Admin payment provider routes
  { path: '/admin/payment-providers', name: 'admin-payment-providers', component: AdminPaymentProvidersView, meta: { auth: true, admin: true } },
  { path: '/admin/payment-providers/new', name: 'admin-create-payment-provider', component: AdminCreatePaymentProviderView, meta: { auth: true, admin: true } },
  { path: '/admin/payment-providers/:id/edit', name: 'admin-edit-payment-provider', component: AdminEditPaymentProviderView, meta: { auth: true, admin: true } },
  { path: '/admin/coupons', name: 'admin-coupons', component: AdminCouponsView, meta: { auth: true, admin: true } },

  // Admin Performance monitor
  { path: '/admin/performance', name: 'admin-performance', component: AdminPerformanceView, meta: { auth: true, admin: true } },
  { path: '/admin/general', name: 'admin-general-settings', component: AdminGeneralSettingsView, meta: { auth: true, admin: true } },
  { path: '/admin/smtp', name: 'admin-smtp-settings', component: AdminSMTPSettingsView, meta: { auth: true, admin: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = getToken()
  const role = getRole()

  if (to.meta.auth && !token) {
    return next('/login')
  }
  if (to.meta.guest && token) {
    return next(role === 'admin' ? '/admin' : '/dashboard')
  }
  if (to.meta.admin && role !== 'admin') {
    return next('/dashboard')
  }
  next()
})

export default router
