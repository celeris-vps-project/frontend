<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import AppLayout from '../components/AppLayout.vue'
import { getOrder } from '../api/billing.js'
import { getPaymentNetworks, initiatePayment } from '../api/payment.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const orderID = route.params.id

// ── State ──
const order = ref(null)
const networks = ref([])
const selectedNetwork = ref('')
const couponCode = ref(typeof route.query.coupon_code === 'string' ? route.query.coupon_code : '')
const loading = ref(true)
const loadError = ref('')

// Payment state: idle | selecting | paying | waiting | confirmed | failed
const step = ref('selecting')
const payError = ref('')
const chargeResult = ref(null)
const qrDataUrl = ref('')
const countdown = ref(0)
const countdownTimer = ref(null)
const pollTimer = ref(null)

// ── Network icons / colors ──
const networkMeta = {
  arbitrum: { icon: '⚡', color: '#28a0f0', label: 'Arbitrum' },
  solana:   { icon: '☀', color: '#9945ff', label: 'Solana' },
  trc20:    { icon: '🔺', color: '#eb0029', label: 'TRON' },
  bsc:      { icon: '💛', color: '#f0b90b', label: 'BSC' },
  polygon:  { icon: '💜', color: '#8247e5', label: 'Polygon' },
}

const normalizedCouponCode = computed(() => couponCode.value.trim())

// ── Load data on mount ──
onMounted(async () => {
  try {
    const [orderData, networkData] = await Promise.all([
      getOrder(orderID),
      getPaymentNetworks()
    ])
    order.value = orderData
    networks.value = networkData

    if (orderData.status === 'active') {
      step.value = 'confirmed'
    }

    // Default select first network
    if (networkData.length > 0) {
      selectedNetwork.value = networkData[0].network
    }
  } catch (err) {
    loadError.value = err.message || t('crypto.failedToLoadPayment')
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (countdownTimer.value) clearInterval(countdownTimer.value)
  if (pollTimer.value) clearInterval(pollTimer.value)
})

// ── Helpers ──
function formatUSDT(cents) {
  return (cents / 100).toFixed(2)
}

function selectedNetworkInfo() {
  return networks.value.find(n => n.network === selectedNetwork.value) || null
}

// ── Pay button ──
async function handlePay() {
  if (!selectedNetwork.value && !normalizedCouponCode.value) return
  payError.value = ''
  step.value = 'paying'

  try {
    const result = await initiatePayment(orderID, selectedNetwork.value, null, normalizedCouponCode.value)
    chargeResult.value = result

    if (result.status === 'success' || result.payable_amount === 0) {
      order.value = { ...order.value, status: 'active' }
      step.value = 'confirmed'
      return
    }

    if (result.crypto) {
      // Generate QR code
      await generateQR(result.crypto.qr_data)

      // Start countdown timer
      const expiresAt = new Date(result.crypto.expires_at).getTime()
      startCountdown(expiresAt)

      // Start polling order status
      startPolling()

      step.value = 'waiting'
    } else {
      // Fallback for non-crypto response
      startPolling()
      step.value = 'waiting'
    }
  } catch (err) {
    payError.value = err.message || t('crypto.paymentInitiationFailed')
    step.value = 'failed'
  }
}

async function generateQR(data) {
  try {
    qrDataUrl.value = await QRCode.toDataURL(data, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    })
  } catch (err) {
    console.warn('QR generation failed:', err)
  }
}

function startCountdown(expiresAt) {
  const update = () => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
    countdown.value = remaining
    if (remaining <= 0) {
      clearInterval(countdownTimer.value)
      if (step.value === 'waiting') {
        step.value = 'failed'
        payError.value = t('crypto.paymentExpired')
      }
    }
  }
  update()
  countdownTimer.value = setInterval(update, 1000)
}

function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function startPolling() {
  let attempts = 0
  const maxAttempts = 600 // 10 minutes at 1s intervals

  pollTimer.value = setInterval(async () => {
    attempts++
    try {
      const updated = await getOrder(orderID)
      order.value = updated

      if (updated.status === 'active') {
        clearInterval(pollTimer.value)
        clearInterval(countdownTimer.value)
        step.value = 'confirmed'
      } else if (attempts >= maxAttempts) {
        clearInterval(pollTimer.value)
        if (step.value === 'waiting') {
          step.value = 'failed'
          payError.value = t('crypto.paymentTimeout')
        }
      }
    } catch {
      // Keep polling on transient errors
    }
  }, 1000)
}

async function copyAddress() {
  const addr = chargeResult.value?.crypto?.wallet_address
  if (!addr) return
  try {
    await navigator.clipboard.writeText(addr)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 2000)
  } catch {
    // Fallback for insecure contexts
    const ta = document.createElement('textarea')
    ta.value = addr
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copyFeedback.value = true
    setTimeout(() => { copyFeedback.value = false }, 2000)
  }
}
const copyFeedback = ref(false)

function retryPayment() {
  step.value = 'selecting'
  payError.value = ''
  chargeResult.value = null
  qrDataUrl.value = ''
  countdown.value = 0
  if (countdownTimer.value) clearInterval(countdownTimer.value)
  if (pollTimer.value) clearInterval(pollTimer.value)
}

function goToInstances() {
  router.push('/instances')
}

function goBack() {
  router.push(`/orders/${orderID}/checkout`)
}
</script>

<template>
  <AppLayout>
    <div class="crypto-pay-page">
      <header class="page-header">
        <h1 class="page-title">
          <span class="usdt-icon">₮</span> {{ t('crypto.titleText') }}
        </h1>
        <p class="page-subtitle">{{ t('crypto.subtitle') }}</p>
      </header>

      <!-- Loading -->
      <div v-if="loading" class="glass-card loading-state">
        <div class="spinner"></div>
        <span>{{ t('crypto.loadingPayment') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="glass-card error-state">
        <p class="error-text">{{ loadError }}</p>
        <button class="action-btn secondary-btn" @click="goBack">{{ t('crypto.backToCheckout') }}</button>
      </div>

      <!-- Main content -->
      <div v-else-if="order" class="pay-content">

        <!-- ═══ Order Summary Bar ═══ -->
        <div class="glass-card summary-bar">
          <div class="summary-item">
            <span class="summary-label">{{ t('crypto.order') }}</span>
            <span class="summary-value mono">{{ order.id?.substring(0, 8) }}...</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">{{ t('crypto.plan') }}</span>
            <span class="summary-value">{{ order.vps?.plan || '—' }}</span>
          </div>
          <div class="summary-item amount-item">
            <span class="summary-label">{{ t('crypto.amount') }}</span>
            <span class="summary-value amount-value">{{ formatUSDT(order.price_amount) }} USDT</span>
          </div>
        </div>

        <!-- ═══ STEP 1: Network Selection ═══ -->
        <div v-if="step === 'selecting'" class="glass-card step-card">
          <div class="step-header">
            <span class="step-number">1</span>
            <h2>{{ t('crypto.selectNetwork') }}</h2>
            <p class="step-desc">{{ t('crypto.selectNetworkDesc') }}</p>
          </div>

          <div class="coupon-box">
            <label class="coupon-label" for="crypto-coupon-code">{{ t('checkout.activationCode') }}</label>
            <div class="coupon-control">
              <input
                id="crypto-coupon-code"
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

          <div class="network-grid">
            <button
              v-for="net in networks"
              :key="net.network"
              class="network-card"
              :class="{ selected: selectedNetwork === net.network }"
              :style="{ '--net-color': networkMeta[net.network]?.color || '#888' }"
              @click="selectedNetwork = net.network"
            >
              <div class="net-icon">{{ networkMeta[net.network]?.icon || '🔗' }}</div>
              <div class="net-info">
                <span class="net-name">{{ net.display_name }}</span>
                <span class="net-standard">{{ net.contract_standard }}</span>
              </div>
              <div class="net-details">
                <span class="net-fee">{{ t('crypto.fee', { fee: net.est_fee_usd < 0.01 ? '< 0.01' : net.est_fee_usd.toFixed(2) }) }}</span>
                <span class="net-time">{{ net.confirmation_time }}</span>
              </div>
              <div class="net-check" v-if="selectedNetwork === net.network">✓</div>
            </button>
          </div>

          <div class="step-actions">
            <button class="action-btn secondary-btn" @click="goBack">{{ t('crypto.backToCheckout') }}</button>
            <button
              class="action-btn primary-btn pay-btn"
              :disabled="!selectedNetwork && !normalizedCouponCode"
              @click="handlePay"
            >
              {{ t('crypto.payAmount', { amount: formatUSDT(order.price_amount) }) }}
              <span v-if="selectedNetwork" class="pay-network">
                {{ t('crypto.via', { network: networkMeta[selectedNetwork]?.label || selectedNetwork }) }}
              </span>
            </button>
          </div>
        </div>

        <!-- ═══ STEP: Paying (loading) ═══ -->
        <div v-else-if="step === 'paying'" class="glass-card step-card">
          <div class="center-state">
            <div class="spinner large-spinner"></div>
            <p class="status-title">{{ t('crypto.initiatingPayment') }}</p>
            <p class="status-desc">{{ t('crypto.generatingWallet') }}</p>
          </div>
        </div>

        <!-- ═══ STEP 2: QR Code & Waiting ═══ -->
        <div v-else-if="step === 'waiting'" class="glass-card step-card waiting-card">
          <div class="step-header">
            <span class="step-number pulse">2</span>
            <h2>{{ t('crypto.sendPayment') }}</h2>
            <p class="step-desc">{{ t('crypto.sendPaymentDesc') }}</p>
          </div>

          <div class="payment-layout">
            <!-- QR Code Panel -->
            <div class="qr-panel">
              <div class="qr-frame">
                <img v-if="qrDataUrl" :src="qrDataUrl" alt="Payment QR Code" class="qr-image" />
                <div v-else class="qr-placeholder">
                  <div class="spinner"></div>
                </div>
              </div>
              <p class="qr-hint">{{ t('crypto.scanWithWallet') }}</p>
            </div>

            <!-- Payment Details -->
            <div class="pay-details">
              <!-- Amount -->
              <div class="detail-row amount-row">
                <span class="detail-label">{{ t('crypto.amountLabel') }}</span>
                <span class="detail-value amount-large">
                  {{ chargeResult?.crypto?.amount_usdt || formatUSDT(order.price_amount) }}
                  <span class="usdt-badge">USDT</span>
                </span>
              </div>

              <!-- Network -->
              <div class="detail-row">
                <span class="detail-label">{{ t('crypto.networkLabel') }}</span>
                <span class="detail-value network-badge" :style="{ '--net-color': networkMeta[chargeResult?.crypto?.network]?.color || '#888' }">
                  {{ networkMeta[chargeResult?.crypto?.network]?.icon }}
                  {{ chargeResult?.crypto?.network_display || selectedNetwork }}
                </span>
              </div>

              <!-- Wallet Address -->
              <div class="detail-row address-row">
                <span class="detail-label">{{ t('crypto.sendToAddress') }}</span>
                <div class="address-box" @click="copyAddress">
                  <span class="address-text">{{ chargeResult?.crypto?.wallet_address }}</span>
                  <button class="copy-btn" :class="{ copied: copyFeedback }">
                    {{ copyFeedback ? t('common.copied') : t('crypto.copyAddress') }}
                  </button>
                </div>
              </div>

              <!-- Countdown -->
              <div class="detail-row countdown-row">
                <span class="detail-label">{{ t('crypto.expiresIn') }}</span>
                <span class="detail-value countdown" :class="{ urgent: countdown < 300 }">
                  ⏱ {{ formatCountdown(countdown) }}
                </span>
              </div>

              <!-- Status -->
              <div class="waiting-status">
                <div class="pulse-dot"></div>
                <span>{{ t('crypto.waitingConfirmation') }}</span>
              </div>
            </div>
          </div>

          <div class="warning-box">
            <strong>{{ t('crypto.warningPrefix') }}</strong>
            {{ t('crypto.warningText', { network: chargeResult?.crypto?.network_display }) }}
          </div>
        </div>

        <!-- ═══ STEP: Confirmed ═══ -->
        <div v-else-if="step === 'confirmed'" class="glass-card step-card">
          <div class="center-state">
            <div class="success-icon">✓</div>
            <p class="status-title">{{ t('crypto.paymentConfirmed') }}</p>
            <p class="status-desc">
              {{ t('crypto.confirmedDesc') }}
            </p>
            <div class="confirmed-actions">
              <button class="action-btn primary-btn" @click="goToInstances">
                {{ t('checkout.viewMyInstances') }}
              </button>
              <router-link
                v-if="chargeResult?.invoice_id"
                :to="'/invoices/' + chargeResult.invoice_id"
                class="action-btn secondary-btn"
              >
                {{ t('checkout.viewInvoice') }}
              </router-link>
            </div>
          </div>
        </div>

        <!-- ═══ STEP: Failed ═══ -->
        <div v-else-if="step === 'failed'" class="glass-card step-card">
          <div class="center-state">
            <div class="fail-icon">✕</div>
            <p class="status-title">{{ t('crypto.paymentFailed') }}</p>
            <p class="status-desc error-text">{{ payError }}</p>
            <button class="action-btn secondary-btn" @click="retryPayment">
              {{ t('crypto.tryAgain') }}
            </button>
          </div>
        </div>

      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.crypto-pay-page {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #26a17b, #50e3a4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.usdt-icon {
  font-size: 1.8rem;
  -webkit-text-fill-color: #26a17b;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* ─── Summary Bar ─── */
.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.summary-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.summary-value.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
}

.amount-value {
  font-size: 1.1rem;
  font-weight: 800;
  color: #26a17b;
}

/* ─── Step Card ─── */
.step-card {
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.step-header {
  margin-bottom: 1.5rem;
}

.step-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #26a17b, #50e3a4);
  color: var(--text-primary);
  font-size: 0.8rem;
  font-weight: 700;
  margin-right: 0.25rem;
}

.step-number.pulse {
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(38, 161, 123, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(38, 161, 123, 0); }
}

.step-desc {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}

/* ─── Coupon code ─── */
.coupon-box {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1rem;
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
  border-color: #26a17b;
  box-shadow: 0 0 0 2px rgba(38, 161, 123, 0.16);
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

/* ─── Network Grid ─── */
.network-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.network-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: inherit;
  font: inherit;
}

.network-card:hover {
  background: var(--bg-input);
  border-color: var(--text-muted);
  transform: translateY(-2px);
}

.network-card.selected {
  border-color: var(--net-color);
  background: var(--bg-input);
  box-shadow: 0 0 0 1px var(--net-color), 0 4px 16px rgba(0, 0, 0, 0.2);
}

.net-icon {
  font-size: 1.5rem;
}

.net-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.net-name {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text-primary);
}

.net-standard {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.net-details {
  display: flex;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.net-fee {
  color: #26a17b;
  font-weight: 500;
}

.net-time {
  color: var(--text-muted);
}

.net-check {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--net-color);
  color: var(--text-primary);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* ─── Step Actions ─── */
.step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.pay-btn {
  padding: 0.85rem 2rem;
  font-size: 1rem;
  font-weight: 700;
  background: linear-gradient(135deg, #26a17b, #1a8a68) !important;
  box-shadow: 0 4px 16px rgba(38, 161, 123, 0.3) !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
}

.pay-btn:hover:not(:disabled) {
  box-shadow: 0 6px 24px rgba(38, 161, 123, 0.45) !important;
  transform: translateY(-1px);
}

.pay-network {
  font-size: 0.72rem;
  font-weight: 400;
  opacity: 0.7;
}

/* ─── Payment Layout (QR + Details) ─── */
.payment-layout {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2rem;
  margin-bottom: 1.5rem;
  align-items: start;
}

@media (max-width: 640px) {
  .payment-layout {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}

/* QR Panel */
.qr-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.qr-frame {
  padding: 12px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.qr-image {
  width: 220px;
  height: 220px;
  display: block;
  border-radius: 4px;
}

.qr-placeholder {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0;
}

/* Payment Details */
.pay-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.amount-large {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.usdt-badge {
  font-size: 0.8rem;
  font-weight: 600;
  color: #26a17b;
  padding: 0.1rem 0.4rem;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 4px;
}

.network-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  font-size: 0.82rem;
  width: fit-content;
}

/* Address Box */
.address-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  background: var(--bg-code);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.address-box:hover {
  border-color: var(--success-border);
  background: var(--bg-code);
}

.address-text {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.72rem;
  color: var(--text-primary);
  word-break: break-all;
  flex: 1;
}

.copy-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--success-border);
  background: var(--success-bg);
  color: #26a17b;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: var(--success-bg);
}

.copy-btn.copied {
  background: var(--success-bg);
  color: #50e3a4;
}

/* Countdown */
.countdown {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.countdown.urgent {
  color: var(--danger);
  animation: urgent-blink 1s step-end infinite;
}

@keyframes urgent-blink {
  50% { opacity: 0.5; }
}

/* Waiting Status */
.waiting-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 8px;
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #26a17b;
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

/* Warning Box */
.warning-box {
  padding: 0.75rem 1rem;
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  border-radius: 8px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.warning-box strong {
  color: var(--warning);
}

/* ─── Center States (loading/success/fail) ─── */
.center-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  padding: 2rem 1rem;
}

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

.status-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.status-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  max-width: 360px;
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--success-bg);
  border: 2px solid var(--success-border);
  color: #26a17b;
  font-size: 1.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fail-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--danger-bg);
  border: 2px solid var(--danger-border);
  color: var(--danger);
  font-size: 1.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirmed-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 0.5rem;
}

/* ─── Shared ─── */
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border-default);
  border-top-color: var(--spinner-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.large-spinner {
  width: 48px;
  height: 48px;
  border-width: 4px;
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
  text-decoration: none;
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

.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  backdrop-filter: blur(20px);
}
</style>
