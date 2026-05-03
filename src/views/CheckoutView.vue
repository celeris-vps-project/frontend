<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import { getOrder } from '../api/billing.js'
import { getPaymentProviders, initiatePayment } from '../api/payment.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const orderID = route.params.id
const order = ref(null)
const loading = ref(true)
const error = ref('')
const paying = ref(false)
const payError = ref('')
const paymentStatus = ref('idle') // idle | processing | confirmed | failed
const pollTimer = ref(null)
const invoiceID = ref('') // linked billing invoice ID
const couponCode = ref('')

// ── Payment providers ──
const providers = ref([])
const providersLoading = ref(true)
const selectedProvider = ref(null)
const normalizedCouponCode = computed(() => couponCode.value.trim())

// ── Provider type metadata (icon, color, label) ──
const providerMeta = {
  crypto_usdt: { icon: '₮', color: '#26a17b', labelKey: 'checkout.providerTypes.cryptoUsdt' },
  stripe:      { icon: '💳', color: '#635bff', labelKey: 'checkout.providerTypes.creditCard' },
  paypal:      { icon: '🅿', color: '#003087', labelKey: 'checkout.providerTypes.paypal' },
  alipay:      { icon: '💙', color: '#1677ff', labelKey: 'checkout.providerTypes.alipay' },
  wechat_pay:  { icon: '💚', color: '#07c160', labelKey: 'checkout.providerTypes.wechatPay' },
  epay:        { icon: '易', color: '#7c3aed', labelKey: 'checkout.providerTypes.epay' },
  custom:      { icon: '🔗', color: '#888888', labelKey: 'checkout.providerTypes.custom' },
}

function getProviderMeta(type) {
  return providerMeta[type] || { icon: '💰', color: '#888', labelKey: '', fallbackLabel: type }
}

function providerTypeLabel(type) {
  const meta = getProviderMeta(type)
  return meta.labelKey ? t(meta.labelKey) : (meta.fallbackLabel || type)
}

// ── Load order + providers on mount ──
onMounted(async () => {
  try {
    const [orderData, providerData] = await Promise.all([
      getOrder(orderID),
      getPaymentProviders().catch(() => [])
    ])

    order.value = orderData
    providers.value = providerData

    if (orderData.status === 'active') {
      paymentStatus.value = 'confirmed'
    }

    // Auto-select first provider if only one is available
    if (providerData.length === 1) {
      selectedProvider.value = providerData[0]
    }
  } catch (err) {
    error.value = err.message || t('checkout.failedToLoadOrder')
  } finally {
    loading.value = false
    providersLoading.value = false
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


// ── Provider selection ──

function selectProvider(provider) {
  selectedProvider.value = provider
}

// ── Pay button text ──
const payButtonText = computed(() => {
  if (!selectedProvider.value) {
    return normalizedCouponCode.value ? t('checkout.redeemCode') : t('checkout.selectMethodFirst')
  }
  const meta = getProviderMeta(selectedProvider.value.type)
  return `${meta.icon} ${t('checkout.payWith', { name: selectedProvider.value.name })}`
})

const canPay = computed(() => {
  return !paying.value && (selectedProvider.value || normalizedCouponCode.value)
})

// ── Pay button handler — routes to appropriate payment page ──

async function handlePay() {
  if (paying.value || paymentStatus.value === 'confirmed' || !canPay.value) return

  const provider = selectedProvider.value
  const code = normalizedCouponCode.value
  paying.value = true
  payError.value = ''

  try {
    // For crypto_usdt, navigate to the dedicated crypto payment page (network selection + QR)
    if (provider?.type === 'crypto_usdt') {
      await router.push({
        path: `/orders/${orderID}/pay`,
        query: code ? { coupon_code: code } : {}
      })
      return
    }

    if (provider?.type === 'epay') {
      await router.push({
        path: `/orders/${orderID}/pay/epay`,
        query: {
          provider_id: provider.id,
          ...(code ? { coupon_code: code } : {})
        }
      })
      return
    }

    // For all other provider types (custom, stripe, paypal, etc.),
    // call the Pay API with provider_id and handle the payment_url redirect.
    const result = await initiatePayment(orderID, null, provider?.id, code)
    invoiceID.value = result.invoice_id || ''

    if (result.status === 'success' || result.payable_amount === 0) {
      paymentStatus.value = 'confirmed'
      order.value = { ...order.value, status: 'active' }
      paying.value = false
      return
    }

    // If the backend returns an external payment URL, redirect the browser
    if (result.payment_url && result.payment_url.startsWith('http')) {
      window.location.href = result.payment_url
      return
    }

    // For mock mode or internal URLs, show processing state and poll
    paymentStatus.value = 'processing'
    startPolling()
  } catch (err) {
    payError.value = err.message || t('checkout.paymentInitiationFailed')
    paymentStatus.value = 'failed'
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
        payError.value = t('checkout.paymentTimeout')
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
        <h1 class="page-title">{{ t('checkout.title') }}</h1>
        <p class="page-subtitle">{{ t('checkout.subtitle') }}</p>
      </header>

      <!-- Loading -->
      <div v-if="loading" class="glass-card loading-state">
        <div class="spinner"></div>
        <span>{{ t('checkout.loadingOrder') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="glass-card error-state">
        <p class="error-text">{{ error }}</p>
        <button class="action-btn secondary-btn" @click="goBack">{{ t('checkout.backToNewInstance') }}</button>
      </div>

      <!-- Checkout panels -->
      <div v-else-if="order" class="checkout-panels">

        <!-- ═══ LEFT: Instance Specs ═══ -->
        <div class="panel glass-card specs-panel">
          <div class="panel-header">
            <span class="panel-icon">⚙</span>
            <h2>{{ t('checkout.instanceSpecs') }}</h2>
          </div>

          <div class="spec-list">
            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.orderId') }}</span>
              <span class="spec-value mono">{{ order.id }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.hostname') }}</span>
              <span class="spec-value mono">{{ order.vps?.hostname || '—' }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.plan') }}</span>
              <span class="spec-value">{{ order.vps?.plan || '—' }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.region') }}</span>
              <span class="spec-value">{{ order.vps?.region || '—' }}</span>
            </div>

            <div class="spec-divider"></div>

            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.cpu') }}</span>
              <span class="spec-value">{{ order.vps?.cpu || '—' }} vCPU</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.memory') }}</span>
              <span class="spec-value">{{ formatMemory(order.vps?.memory_mb) }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-label">{{ t('checkout.disk') }}</span>
              <span class="spec-value">{{ order.vps?.disk_gb || '—' }} GB NVMe</span>
            </div>
          </div>
        </div>

        <!-- ═══ RIGHT: Payment Detail ═══ -->
        <div class="panel glass-card payment-panel">
          <div class="panel-header">
            <span class="panel-icon">💳</span>
            <h2>{{ t('checkout.paymentDetails') }}</h2>
          </div>

          <!-- Order status badge -->
          <div class="status-row">
            <span class="status-label">{{ t('checkout.orderStatus') }}</span>
            <span class="status-badge" :class="order.status">{{ order.status }}</span>
          </div>

          <!-- Payment summary -->
          <div class="payment-summary">
            <div class="pay-row">
              <span class="pay-label">{{ t('checkout.amount') }}</span>
              <span class="pay-value price-large">{{ formatPrice(order.price_amount, order.currency) }}</span>
            </div>
            <div class="pay-row">
              <span class="pay-label">{{ t('checkout.currencyLabel') }}</span>
              <span class="pay-value">{{ (order.currency || '').toUpperCase() }}</span>
            </div>
          </div>

          <div class="pay-divider"></div>

          <!-- ═══ Payment Method Selection ═══ -->
          <div v-if="paymentStatus === 'idle'" class="provider-section">
            <div class="coupon-box">
              <label class="coupon-label" for="coupon-code">{{ t('checkout.activationCode') }}</label>
              <div class="coupon-control">
                <input
                  id="coupon-code"
                  v-model="couponCode"
                  type="text"
                  class="coupon-input"
                  :placeholder="t('checkout.activationCodePlaceholder')"
                  autocomplete="off"
                />
                <button
                  v-if="couponCode"
                  type="button"
                  class="coupon-clear"
                  :title="t('common.cancel')"
                  @click="couponCode = ''"
                >
                  ×
                </button>
              </div>
            </div>

            <div class="pay-divider compact"></div>

            <div class="provider-section-header">
              <span class="provider-section-label">{{ t('checkout.selectPaymentMethod') }}</span>
            </div>

            <!-- Loading providers -->
            <div v-if="providersLoading" class="providers-loading">
              <div class="spinner small-spinner"></div>
              <span>{{ t('checkout.loadingProviders') }}</span>
            </div>

            <!-- No providers available -->
            <div v-else-if="providers.length === 0" class="no-providers">
              <span class="no-providers-icon">⚠</span>
              <p class="no-providers-text">{{ t('checkout.noPaymentMethods') }}</p>
            </div>

            <!-- Provider cards -->
            <div v-else class="provider-list">
              <button
                v-for="provider in providers"
                :key="provider.id"
                class="provider-card"
                :class="{ selected: selectedProvider?.id === provider.id }"
                :style="{ '--provider-color': getProviderMeta(provider.type).color }"
                @click="selectProvider(provider)"
              >
                <div class="provider-icon">{{ getProviderMeta(provider.type).icon }}</div>
                <div class="provider-info">
                  <span class="provider-name">{{ provider.name }}</span>
                  <span class="provider-type-label">{{ providerTypeLabel(provider.type) }}</span>
                  <!-- Show supported networks for crypto providers -->
                  <div v-if="provider.networks && provider.networks.length > 0" class="provider-networks">
                    <span
                      v-for="net in provider.networks"
                      :key="net"
                      class="network-tag"
                    >{{ net }}</span>
                  </div>
                </div>
                <div class="provider-check" v-if="selectedProvider?.id === provider.id">✓</div>
              </button>
            </div>

            <div class="pay-divider"></div>

            <!-- Pay action -->
            <div class="pay-action">
              <p class="pay-info">
                {{ selectedProvider
                  ? t('checkout.payInfo')
                  : (normalizedCouponCode ? t('checkout.couponOnlyHint') : t('checkout.selectMethodHint'))
                }}
              </p>
              <button
                class="action-btn primary-btn pay-btn"
                :class="{ 'provider-pay-btn': selectedProvider, loading: paying }"
                :style="selectedProvider ? { '--btn-color': getProviderMeta(selectedProvider.type).color } : {}"
                @click="handlePay"
                :disabled="!canPay"
              >
                <span v-if="paying" class="button-spinner"></span>
                <span>{{ paying ? t('checkout.processingPayment') : payButtonText }}</span>
              </button>
            </div>
          </div>

          <!-- Processing: waiting for webhook -->
          <div v-else-if="paymentStatus === 'processing'" class="pay-status processing">
            <div class="spinner"></div>
            <div class="status-info">
              <p class="status-title">{{ t('checkout.processingPayment') }}</p>
              <p class="status-desc">{{ t('checkout.processingDesc') }}</p>
            </div>
          </div>

          <!-- Confirmed: success! -->
          <div v-else-if="paymentStatus === 'confirmed'" class="pay-status confirmed">
            <div class="success-icon">✓</div>
            <div class="status-info">
              <p class="status-title">{{ t('checkout.paymentConfirmed') }}</p>
              <p class="status-desc">{{ t('checkout.confirmedDesc') }}</p>
              <p v-if="invoiceID" class="status-desc invoice-link">
                {{ t('checkout.invoice') }}: <router-link :to="'/invoices/' + invoiceID" class="invoice-id">{{ invoiceID }}</router-link>
              </p>
            </div>
            <div class="confirmed-actions">
              <button class="action-btn primary-btn" @click="goToInstances">
                {{ t('checkout.viewMyInstances') }}
              </button>
              <router-link v-if="invoiceID" :to="'/invoices/' + invoiceID" class="action-btn secondary-btn">
                {{ t('checkout.viewInvoice') }}
              </router-link>
            </div>
          </div>

          <!-- Failed -->
          <div v-else-if="paymentStatus === 'failed'" class="pay-status failed">
            <div class="fail-icon">✕</div>
            <div class="status-info">
              <p class="status-title">{{ t('checkout.paymentFailed') }}</p>
              <p class="status-desc error-text">{{ payError }}</p>
            </div>
            <button class="action-btn secondary-btn" @click="paymentStatus = 'idle'; payError = ''">
              {{ t('checkout.tryAgain') }}
            </button>
          </div>

          <!-- Already paid (loaded with active status) -->
          <div v-if="order.status === 'active' && paymentStatus === 'idle'" class="pay-status confirmed">
            <div class="success-icon">✓</div>
            <div class="status-info">
              <p class="status-title">{{ t('checkout.alreadyPaid') }}</p>
              <p class="status-desc">{{ t('checkout.alreadyPaidDesc') }}</p>
            </div>
            <button class="action-btn primary-btn" @click="goToInstances">
              {{ t('checkout.viewMyInstances') }}
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
  background: none;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* ─── Loading / Error ─── */
.loading-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  justify-content: center;
  color: var(--text-secondary);
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
}

.error-text {
  color: var(--danger);
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
  border-bottom: 1px solid var(--divider);
}

.panel-icon {
  font-size: 1.2rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--text-muted);
}

.spec-value {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

.spec-value.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.78rem;
}

.spec-divider {
  height: 1px;
  background: var(--bg-input);
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
  color: var(--text-muted);
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
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.status-badge.active {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.status-badge.cancelled, .status-badge.terminated {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
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
  color: var(--text-muted);
}

.pay-value {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

.price-large {
  font-size: 1.3rem;
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.pay-divider {
  height: 1px;
  background: var(--bg-input);
  margin: 1.25rem 0;
}

.pay-divider.compact {
  margin: 0.75rem 0;
}

/* ─── Coupon code ─── */
.coupon-box {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.coupon-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.coupon-control {
  position: relative;
}

.coupon-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.9rem;
  padding: 0.7rem 2.3rem 0.7rem 0.85rem;
  outline: none;
  text-transform: uppercase;
}

.coupon-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.coupon-input::placeholder {
  color: var(--text-muted);
  text-transform: none;
}

.coupon-clear {
  position: absolute;
  top: 50%;
  right: 0.65rem;
  width: 24px;
  height: 24px;
  transform: translateY(-50%);
  border: none;
  border-radius: 50%;
  background: var(--bg-card);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.coupon-clear:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

/* ─── Provider Selection Section ─── */
.provider-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.provider-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.provider-section-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.providers-loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem 0;
  justify-content: center;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.no-providers {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  text-align: center;
}

.no-providers-icon {
  font-size: 1.5rem;
  opacity: 0.6;
}

.no-providers-text {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

/* ─── Provider Cards ─── */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.provider-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-default);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: inherit;
  font: inherit;
  width: 100%;
}

.provider-card:hover {
  background: var(--bg-input);
  border-color: var(--text-muted);
}

.provider-card.selected {
  border-color: var(--provider-color);
  background: var(--bg-input);
  box-shadow: 0 0 0 1px var(--provider-color), 0 2px 8px rgba(0, 0, 0, 0.15);
}

.provider-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bg-input);
  font-size: 1.2rem;
  flex-shrink: 0;
}

.provider-card.selected .provider-icon {
  background: color-mix(in srgb, var(--provider-color) 15%, transparent);
}

.provider-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-type-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.provider-networks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.25rem;
}

.network-tag {
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 500;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.provider-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--provider-color);
  color: #fff;
  font-size: 0.72rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

/* ─── Pay action (idle) ─── */
.pay-action {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pay-info {
  font-size: 0.82rem;
  color: var(--text-muted);
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
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.button-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

.provider-pay-btn {
  background: linear-gradient(135deg, var(--btn-color), color-mix(in srgb, var(--btn-color) 80%, #000)) !important;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--btn-color) 30%, transparent) !important;
}

.provider-pay-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px color-mix(in srgb, var(--btn-color) 45%, transparent) !important;
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
  color: var(--text-secondary);
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
  color: var(--text-primary);
}

.status-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-muted);
  line-height: 1.45;
}

.success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--success-bg);
  border: 2px solid var(--success-border);
  color: var(--success);
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
  background: var(--danger-bg);
  border: 2px solid var(--danger-border);
  color: var(--danger);
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
  border: 3px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.small-spinner {
  width: 18px;
  height: 18px;
  border-width: 2px;
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
  background: var(--accent-gradient);
  color: var(--text-primary);
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
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.secondary-btn:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
}

/* ─── Invoice link & confirmed actions ─── */
.invoice-link {
  margin-top: 0.25rem;
}

.invoice-id {
  color: var(--accent);
  text-decoration: none;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.78rem;
}

.invoice-id:hover {
  text-decoration: underline;
  color: var(--accent-light);
}

.confirmed-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
