<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getOrder,
  getInvoice,
  listInstances,
  formatMoney,
  formatDateTime
} from '../api/billing.js'
import { streamPaymentStatus } from '../api/payment.js'

const POLL_INTERVAL_MS = 5000
const REDIRECT_SECONDS = 5

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const orderID = computed(() => route.params.id)
const order = ref(null)
const invoice = ref(null)
const instance = ref(null)
const loading = ref(true)
const error = ref('')
const pollTimer = ref(null)
const redirectTimer = ref(null)
const statusStream = ref(null)
const redirectRemaining = ref(REDIRECT_SECONDS)

const gatewayState = computed(() => normalizeGatewayState(
  route.query.result || route.query.status || route.query.type || route.query.trade_status
))

const paid = computed(() => {
  return order.value?.status === 'active' || invoice.value?.status === 'paid'
})

const cancelledOrFailed = computed(() => {
  if (paid.value) return false
  if (['cancelled', 'terminated'].includes(order.value?.status)) return true
  if (invoice.value?.status === 'void') return true
  return ['cancelled', 'failed'].includes(gatewayState.value)
})

const viewState = computed(() => {
  if (loading.value && !order.value) return 'loading'
  if (error.value && !order.value) return 'error'
  if (paid.value) return 'confirmed'
  if (cancelledOrFailed.value) return gatewayState.value === 'cancelled' ? 'cancelled' : 'failed'
  return 'waiting'
})

const waitingTitle = computed(() => {
  return gatewayState.value === 'success'
    ? t('paymentStatus.gatewaySuccessTitle')
    : t('paymentStatus.waitingTitle')
})

const instanceTarget = computed(() => {
  return instance.value?.id ? `/instances/${instance.value.id}` : '/instances'
})

const pageSubtitle = computed(() => {
  const shortID = String(orderID.value || '').slice(0, 8)
  return t('paymentStatus.subtitle', { id: shortID })
})

onMounted(async () => {
  await refreshStatus()
  startStatusStream()
  startPolling()
})

onUnmounted(() => {
  stopStatusStream()
  stopPolling()
  stopRedirect()
})

function normalizeGatewayState(value) {
  const state = String(value || '').trim().toLowerCase()
  if (['success', 'succeeded', 'paid', 'active', 'completed', 'trade_success'].includes(state)) return 'success'
  if (['cancel', 'cancelled', 'canceled', 'closed'].includes(state)) return 'cancelled'
  if (['fail', 'failed', 'error'].includes(state)) return 'failed'
  return ''
}

async function refreshStatus() {
  if (!orderID.value) return
  error.value = ''

  try {
    const nextOrder = await getOrder(orderID.value)
    order.value = nextOrder

    if (nextOrder.invoice_id) {
      invoice.value = await getInvoice(nextOrder.invoice_id).catch(() => invoice.value)
    }

    if (nextOrder.status === 'active' || invoice.value?.status === 'paid') {
      await refreshInstance()
      startRedirect()
    }
  } catch (err) {
    if (!order.value) {
      error.value = err.message || t('paymentStatus.loadFailed')
    }
  } finally {
    loading.value = false
  }
}

async function refreshInstance() {
  const instances = await listInstances().catch(() => [])
  const matched = instances.find((item) => item.order_id === orderID.value)
  if (matched) instance.value = matched
}

function startPolling() {
  if (pollTimer.value) return
  pollTimer.value = setInterval(refreshStatus, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (!pollTimer.value) return
  clearInterval(pollTimer.value)
  pollTimer.value = null
}

function startStatusStream() {
  if (statusStream.value || !orderID.value) return
  statusStream.value = streamPaymentStatus(orderID.value, {
    async onStatus() {
      await refreshStatus()
    },
    onError() {
      statusStream.value = null
    }
  })
}

function stopStatusStream() {
  if (!statusStream.value) return
  statusStream.value.close()
  statusStream.value = null
}

function startRedirect() {
  if (redirectTimer.value) return
  stopStatusStream()
  stopPolling()
  redirectRemaining.value = REDIRECT_SECONDS
  redirectTimer.value = setInterval(() => {
    redirectRemaining.value -= 1
    if (redirectRemaining.value <= 0) {
      stopRedirect()
      router.push(instanceTarget.value)
    }
  }, 1000)
}

function stopRedirect() {
  if (!redirectTimer.value) return
  clearInterval(redirectTimer.value)
  redirectTimer.value = null
}

function retryPayment() {
  router.push(`/orders/${orderID.value}/checkout`)
}

function goToInstance() {
  router.push(instanceTarget.value)
}

function formatMemory(mb) {
  if (!mb) return '-'
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`
}

function instanceSpecs(inst) {
  if (!inst) return '-'
  return `${inst.cpu || '-'} vCPU / ${formatMemory(inst.memory_mb)} / ${inst.disk_gb || '-'} GB`
}

function primaryAccess(inst) {
  if (!inst) return '-'
  if (inst.network_mode === 'nat') {
    const ports = Array.isArray(inst.nat_ports) ? inst.nat_ports : []
    if (inst.host_ip && ports.length > 0) return `${inst.host_ip}:${ports.join(', ')}`
    if (inst.host_ip && inst.nat_port) return `${inst.host_ip}:${inst.nat_port}`
    if (inst.host_ip) return inst.host_ip
    return t('paymentStatus.waitingNetwork')
  }
  return inst.ipv4 || inst.ipv6 || t('paymentStatus.waitingNetwork')
}
</script>

<template>
  <AppLayout>
    <div class="payment-status-page">
      <header class="page-header">
        <h1 class="page-title">{{ t('paymentStatus.title') }}</h1>
        <p class="page-subtitle">{{ pageSubtitle }}</p>
      </header>

      <section v-if="viewState === 'loading'" class="status-card glass-card">
        <div class="spinner large-spinner"></div>
        <h2>{{ t('paymentStatus.loading') }}</h2>
      </section>

      <section v-else-if="viewState === 'error'" class="status-card glass-card">
        <div class="fail-icon">!</div>
        <h2>{{ t('paymentStatus.loadFailed') }}</h2>
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn" @click="refreshStatus">{{ t('common.retry') }}</button>
      </section>

      <section v-else-if="viewState === 'waiting'" class="status-card glass-card">
        <div class="spinner large-spinner"></div>
        <h2>{{ waitingTitle }}</h2>
        <p>{{ t('paymentStatus.waitingDesc') }}</p>
        <div v-if="order" class="compact-summary">
          <div>
            <span>{{ t('paymentStatus.order') }}</span>
            <strong class="mono">{{ order.id }}</strong>
          </div>
          <div>
            <span>{{ t('paymentStatus.orderStatus') }}</span>
            <StatusBadge :status="order.status" />
          </div>
          <div>
            <span>{{ t('paymentStatus.amount') }}</span>
            <strong>{{ formatMoney(order.price_amount, order.currency) }}</strong>
          </div>
        </div>
      </section>

      <section v-else-if="viewState === 'confirmed'" class="status-card glass-card success-card">
        <div class="success-icon">✓</div>
        <h2>{{ t('paymentStatus.confirmedTitle') }}</h2>
        <p>{{ t('paymentStatus.confirmedDesc') }}</p>
        <p class="redirect-copy">{{ t('paymentStatus.redirecting', { seconds: redirectRemaining }) }}</p>
        <button class="action-btn primary-btn" @click="goToInstance">
          {{ t('paymentStatus.viewInstanceNow') }}
        </button>
      </section>

      <section v-else class="status-card glass-card">
        <div class="fail-icon">{{ viewState === 'cancelled' ? '×' : '!' }}</div>
        <h2>
          {{ viewState === 'cancelled' ? t('paymentStatus.cancelledTitle') : t('paymentStatus.failedTitle') }}
        </h2>
        <p>
          {{ viewState === 'cancelled' ? t('paymentStatus.cancelledDesc') : t('paymentStatus.failedDesc') }}
        </p>
        <div class="action-row">
          <button class="action-btn primary-btn" @click="retryPayment">{{ t('paymentStatus.retryPayment') }}</button>
          <button class="action-btn secondary-btn" @click="refreshStatus">{{ t('paymentStatus.checkAgain') }}</button>
        </div>
      </section>

      <div v-if="viewState === 'confirmed'" class="detail-grid">
        <section class="detail-panel glass-card">
          <div class="panel-header">
            <h2>{{ t('paymentStatus.instanceInfo') }}</h2>
            <StatusBadge v-if="instance" :status="instance.status" />
          </div>

          <div v-if="instance" class="info-list">
            <div class="info-row">
              <span>{{ t('instanceDetail.instanceId') }}</span>
              <strong class="mono">{{ instance.id }}</strong>
            </div>
            <div class="info-row">
              <span>{{ t('instanceDetail.hostname') }}</span>
              <strong class="mono">{{ instance.hostname }}</strong>
            </div>
            <div class="info-row">
              <span>{{ t('instanceDetail.plan') }}</span>
              <strong>{{ instance.plan }}</strong>
            </div>
            <div class="info-row">
              <span>{{ t('instanceDetail.specs') }}</span>
              <strong>{{ instanceSpecs(instance) }}</strong>
            </div>
            <div class="info-row">
              <span>{{ t('instanceDetail.primaryAccess') }}</span>
              <strong class="mono">{{ primaryAccess(instance) }}</strong>
            </div>
            <div v-if="instance.initial_password" class="info-row">
              <span>{{ t('instanceDetail.initialPassword') }}</span>
              <strong class="mono secret-value">{{ instance.initial_password }}</strong>
            </div>
          </div>

          <div v-else class="syncing-box">
            <div class="spinner small-spinner"></div>
            <span>{{ t('paymentStatus.instanceSyncing') }}</span>
          </div>
        </section>

        <section class="detail-panel glass-card">
          <div class="panel-header">
            <h2>{{ t('paymentStatus.invoiceInfo') }}</h2>
            <StatusBadge v-if="invoice" :status="invoice.status" />
          </div>

          <div v-if="invoice" class="info-list">
            <div class="info-row">
              <span>{{ t('invoiceDetail.invoiceId') }}</span>
              <router-link class="mono inline-link" :to="'/invoices/' + invoice.id">{{ invoice.id }}</router-link>
            </div>
            <div class="info-row">
              <span>{{ t('invoiceDetail.total') }}</span>
              <strong>{{ formatMoney(invoice.total, invoice.currency) }}</strong>
            </div>
            <div class="info-row">
              <span>{{ t('invoiceDetail.paid') }}</span>
              <strong>{{ formatMoney(invoice.amount_paid, invoice.currency) }}</strong>
            </div>
            <div class="info-row">
              <span>{{ t('invoiceDetail.currencyLabel') }}</span>
              <strong>{{ invoice.currency?.toUpperCase() }}</strong>
            </div>
            <div v-if="invoice.paid_at" class="info-row">
              <span>{{ t('invoiceDetail.paidAt') }}</span>
              <strong>{{ formatDateTime(invoice.paid_at) }}</strong>
            </div>
          </div>

          <div v-else class="syncing-box">
            <div class="spinner small-spinner"></div>
            <span>{{ t('paymentStatus.invoiceSyncing') }}</span>
          </div>
        </section>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.payment-status-page {
  max-width: 980px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.8rem;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0.3rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.status-card {
  min-height: 260px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  text-align: center;
}

.status-card h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.25rem;
}

.status-card p {
  margin: 0;
  max-width: 520px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.success-card {
  min-height: 300px;
}

.redirect-copy {
  color: var(--success) !important;
  font-weight: 600;
}

.compact-summary {
  width: min(100%, 640px);
  margin-top: 0.75rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.compact-summary > div {
  padding: 0.85rem;
  border-radius: 10px;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.compact-summary span,
.info-row span {
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.compact-summary strong {
  color: var(--text-primary);
  word-break: break-all;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.detail-panel {
  padding: 1.25rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.8rem;
  margin-bottom: 0.8rem;
  border-bottom: 1px solid var(--divider);
}

.panel-header h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-primary);
}

.info-list {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.info-row:last-child {
  border-bottom: none;
}

.info-row strong,
.inline-link {
  color: var(--text-primary);
  font-size: 0.86rem;
  text-align: right;
  max-width: 62%;
  word-break: break-all;
}

.inline-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}

.inline-link:hover {
  text-decoration: underline;
}

.syncing-box {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  color: var(--text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.large-spinner {
  width: 54px;
  height: 54px;
  border-width: 4px;
}

.small-spinner {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.success-icon,
.fail-icon {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.65rem;
  font-weight: 800;
}

.success-icon {
  color: var(--success);
  background: var(--success-bg);
  border: 2px solid var(--success-border);
}

.fail-icon {
  color: var(--danger);
  background: var(--danger-bg);
  border: 2px solid var(--danger-border);
}

.action-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem 1.15rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: var(--accent-gradient);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}

.secondary-btn {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.secondary-btn:hover {
  background: var(--bg-card-hover);
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.secret-value {
  user-select: all;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .status-card {
    padding: 1.5rem;
  }

  .compact-summary,
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .info-row {
    flex-direction: column;
    gap: 0.35rem;
  }

  .info-row strong,
  .inline-link {
    max-width: 100%;
    text-align: left;
  }
}
</style>
