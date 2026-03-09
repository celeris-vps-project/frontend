<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { getOrder, payOrder } from '../api/billing.js'

const route = useRoute()
const router = useRouter()

const orderID = route.params.id
const order = ref(null)
const loading = ref(true)
const error = ref('')
const paying = ref(false)
const payError = ref('')
const paymentStatus = ref('idle') // idle | processing | confirmed | failed
const pollTimer = ref(null)

// ── Load order on mount ──
onMounted(async () => {
  try {
    order.value = await getOrder(orderID)
    if (order.value.status === 'active') {
      paymentStatus.value = 'confirmed'
    }
  } catch (err) {
    error.value = err.message || 'Failed to load order'
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value)
})

// ── Formatting helpers ──

function formatMemory(mb) {
  if (!mb) return '—'
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`
}

function formatPrice(cents, currency) {
  const sym = { USD: '$', EUR: '€', GBP: '£' }
  const prefix = sym[currency?.toUpperCase()] || (currency || '') + ' '
  return `${prefix}${(cents / 100).toFixed(2)}`
}

function formatCycleLabel(cycle) {
  const map = { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' }
  return map[cycle] || cycle || 'One-time'
}

const osList = {
  'ubuntu-22.04': 'Ubuntu 22.04 LTS',
  'ubuntu-24.04': 'Ubuntu 24.04 LTS',
  'debian-12': 'Debian 12',
  'centos-9': 'CentOS Stream 9',
  'rocky-9': 'Rocky Linux 9',
  'windows-2022': 'Windows Server 2022'
}

function osLabel(os) {
  return osList[os] || os || '—'
}

// ── Pay button handler ──

async function handlePay() {
  if (paying.value || paymentStatus.value === 'confirmed') return
  payError.value = ''
  paying.value = true
  paymentStatus.value = 'processing'

  try {
    const result = await payOrder(orderID)

    // Mock provider returns "pending" — we need to poll for the webhook to fire
    if (result.status === 'pending') {
      startPolling()
    } else if (result.status === 'success') {
      paymentStatus.value = 'confirmed'
      paying.value = false
    } else {
      paymentStatus.value = 'failed'
      payError.value = 'Payment was not successful: ' + (result.message || result.status)
      paying.value = false
    }
  } catch (err) {
    paymentStatus.value = 'failed'
    payError.value = err.message || 'Payment failed'
    paying.value = false
  }
}

// ── Poll order status until it becomes "active" ──

function startPolling() {
  let attempts = 0
  const maxAttempts = 30 // 30 * 1s = 30s max

  pollTimer.value = setInterval(async () => {
    attempts++
    try {
      const updated = await getOrder(orderID)
      order.value = updated

      if (updated.status === 'active') {
        clearInterval(pollTimer.value)
        pollTimer.value = null
        paymentStatus.value = 'confirmed'
        paying.value = false
      } else if (attempts >= maxAttempts) {
        clearInterval(pollTimer.value)
        pollTimer.value = null
        paymentStatus.value = 'failed'
        payError.value = 'Payment confirmation timed out. Please check your order status.'
        paying.value = false
      }
    } catch {
      // Keep polling on transient errors
    }
  }, 1000)
}

// ── Navigate to instances after success ──

function goToInstances() {
  router.push('/instances')
}

function goBack() {
  router.push('/instances/new')
}
</script>

<template>
  <AppLayout>
    <div class="checkout-page">
      <header class="page-header">
        <h1 class="page-title">Checkout</h1>
        <p class="page-subtitle">Review and complete your payment</p>
      </header>

      <!-- Loading -->
      <div v-if="loading" class="glass-card loading-state">
        <div class="spinner"></div>
        <span>Loading order details...</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="glass-card error-state">
        <p class="error-text">{{ error }}</p>
        <button class="action-btn secondary-btn" @click="goBack">← Back to New Instance</button>
      </div>

      <!-- Checkout panels -->
      <div v-else-if="order" class="checkout-panels">

        <!-- ═══ LEFT: Instance Specs ═══ -->
        <div class="panel glass-card specs-panel">
          <div class="panel-header">
            <span class="panel-icon">⚙</span>
            <h2>Instance Specifications</h2>
          </div>

          <div class="spec-list">
            <div class="spec-item">
              <span class="spec-label">Order ID</span>
              <span class="spec-value mono">{{ order.id }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Hostname</span>
              <span class="spec-value mono">{{ order.vps?.hostname || '—' }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Plan</span>
              <span class="spec-value">{{ order.vps?.plan || '—' }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Region</span>
              <span class="spec-value">{{ order.vps?.region || '—' }}</span>
            </div>

            <div class="spec-divider"></div>

            <div class="spec-item">
              <span class="spec-label">CPU</span>
              <span class="spec-value">{{ order.vps?.cpu || '—' }} vCPU</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Memory</span>
              <span class="spec-value">{{ formatMemory(order.vps?.memory_mb) }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Disk</span>
              <span class="spec-value">{{ order.vps?.disk_gb || '—' }} GB NVMe</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">Operating System</span>
              <span class="spec-value">{{ osLabel(order.vps?.os) }}</span>
            </div>
          </div>
        </div>

        <!-- ═══ RIGHT: Payment Detail ═══ -->
        <div class="panel glass-card payment-panel">
          <div class="panel-header">
            <span class="panel-icon">💳</span>
            <h2>Payment Details</h2>
          </div>

          <!-- Order status badge -->
          <div class="status-row">
            <span class="status-label">Order Status</span>
            <span class="status-badge" :class="order.status">{{ order.status }}</span>
          </div>

          <!-- Payment summary -->
          <div class="payment-summary">
            <div class="pay-row">
              <span class="pay-label">Amount</span>
              <span class="pay-value price-large">{{ formatPrice(order.price_amount, order.currency) }}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">Currency</span>
              <span class="pay-value">{{ (order.currency || '').toUpperCase() }}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">Payment Method</span>
              <span class="pay-value method-badge">Mock Payment Gateway</span>
            </div>
          </div>

          <div class="pay-divider"></div>

          <!-- Payment states -->

          <!-- Idle: ready to pay -->
          <div v-if="paymentStatus === 'idle'" class="pay-action">
            <p class="pay-info">Click below to complete your payment. Your instance will be provisioned automatically after payment confirmation.</p>
            <button class="action-btn primary-btn pay-btn" @click="handlePay" :disabled="paying">
              Pay {{ formatPrice(order.price_amount, order.currency) }}
            </button>
          </div>

          <!-- Processing: waiting for webhook -->
          <div v-else-if="paymentStatus === 'processing'" class="pay-status processing">
            <div class="spinner"></div>
            <div class="status-info">
              <p class="status-title">Processing Payment...</p>
              <p class="status-desc">Awaiting confirmation from the payment gateway. This typically takes a few seconds.</p>
            </div>
          </div>

          <!-- Confirmed: success! -->
          <div v-else-if="paymentStatus === 'confirmed'" class="pay-status confirmed">
            <div class="success-icon">✓</div>
            <div class="status-info">
              <p class="status-title">Payment Confirmed!</p>
              <p class="status-desc">Your order has been activated and instance provisioning has been triggered.</p>
            </div>
            <button class="action-btn primary-btn" @click="goToInstances">
              View My Instances →
            </button>
          </div>

          <!-- Failed -->
          <div v-else-if="paymentStatus === 'failed'" class="pay-status failed">
            <div class="fail-icon">✕</div>
            <div class="status-info">
              <p class="status-title">Payment Failed</p>
              <p class="status-desc error-text">{{ payError }}</p>
            </div>
            <button class="action-btn secondary-btn" @click="paymentStatus = 'idle'; payError = ''">
              Try Again
            </button>
          </div>

          <!-- Already paid (loaded with active status) -->
          <div v-if="order.status === 'active' && paymentStatus === 'idle'" class="pay-status confirmed">
            <div class="success-icon">✓</div>
            <div class="status-info">
              <p class="status-title">Already Paid</p>
              <p class="status-desc">This order has already been paid and activated.</p>
            </div>
            <button class="action-btn primary-btn" @click="goToInstances">
              View My Instances →
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.checkout-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.95rem;
}

/* ─── Loading / Error ─── */
.loading-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
}

.error-text {
  color: #fca5a5;
}

/* ─── Checkout panels ─── */
.checkout-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 768px) {
  .checkout-panels {
    grid-template-columns: 1fr;
  }
}

.panel {
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-icon {
  font-size: 1.2rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #fff;
}

/* ─── Specs panel ─── */
.spec-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.spec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
}

.spec-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

.spec-value {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.spec-value.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.78rem;
}

.spec-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0.35rem 0;
}

/* ─── Payment panel ─── */
.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.status-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

.status-badge {
  padding: 0.2rem 0.65rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.status-badge.pending {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.25);
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.status-badge.cancelled, .status-badge.terminated {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.payment-summary {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.pay-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pay-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

.pay-value {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.price-large {
  font-size: 1.3rem;
  font-weight: 800;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.method-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  font-size: 0.75rem;
  color: #a78bfa;
}

.pay-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 1.25rem 0;
}

/* ─── Pay action (idle) ─── */
.pay-action {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pay-info {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.5;
  margin: 0;
}

.pay-btn {
  width: 100%;
  padding: 0.85rem;
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
  border-radius: 10px;
}

/* ─── Pay status states ─── */
.pay-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 0.5rem 0;
}

.pay-status.processing {
  color: rgba(255, 255, 255, 0.6);
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.status-desc {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.45;
}

.success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.15);
  border: 2px solid rgba(34, 197, 94, 0.4);
  color: #4ade80;
  font-size: 1.4rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fail-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  border: 2px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
  font-size: 1.4rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Shared ─── */
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.primary-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.primary-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
  transform: translateY(-1px);
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
</style>
