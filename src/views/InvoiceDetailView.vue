<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getInvoice,
  addLineItem,
  setTax,
  issueInvoice,
  recordPayment,
  voidInvoice,
  formatMoney,
  formatDate,
  billingCycleLabel
} from '../api/billing.js'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const invoice = ref(null)
const loading = ref(true)
const error = ref('')
const actionLoading = ref(false)
const actionError = ref('')
const actionSuccess = ref('')

// Line item form
const showLineItemForm = ref(false)
const newItem = ref({ description: '', quantity: 1, unit_price: 0 })

// Tax form
const showTaxForm = ref(false)
const taxAmount = ref(0)

// Issue form
const showIssueForm = ref(false)
const dueDate = ref('')

// Payment form
const showPaymentForm = ref(false)
const paymentAmount = ref(0)

// Void form
const showVoidForm = ref(false)
const voidReason = ref('')

onMounted(fetchInvoice)

async function fetchInvoice() {
  loading.value = true
  error.value = ''
  try {
    invoice.value = await getInvoice(route.params.id)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleAddLineItem() {
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    invoice.value = await addLineItem(route.params.id, {
      id,
      description: newItem.value.description,
      quantity: newItem.value.quantity,
      unit_price: Math.round(newItem.value.unit_price * 100)
    })
    newItem.value = { description: '', quantity: 1, unit_price: 0 }
    showLineItemForm.value = false
    actionSuccess.value = 'Line item added'
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = false
  }
}

async function handleSetTax() {
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    invoice.value = await setTax(route.params.id, Math.round(taxAmount.value * 100))
    showTaxForm.value = false
    actionSuccess.value = 'Tax updated'
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = false
  }
}

async function handleIssue() {
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    const due = dueDate.value ? new Date(dueDate.value).toISOString() : null
    invoice.value = await issueInvoice(route.params.id, due)
    showIssueForm.value = false
    actionSuccess.value = 'Invoice issued'
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = false
  }
}

async function handlePayment() {
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    invoice.value = await recordPayment(route.params.id, Math.round(paymentAmount.value * 100))
    showPaymentForm.value = false
    paymentAmount.value = 0
    actionSuccess.value = 'Payment recorded'
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = false
  }
}

async function handleVoid() {
  actionLoading.value = true
  actionError.value = ''
  actionSuccess.value = ''
  try {
    invoice.value = await voidInvoice(route.params.id, voidReason.value)
    showVoidForm.value = false
    voidReason.value = ''
    actionSuccess.value = 'Invoice voided'
  } catch (err) {
    actionError.value = err.message
  } finally {
    actionLoading.value = false
  }
}

const paymentProgress = computed(() => {
  if (!invoice.value || invoice.value.total === 0) return 0
  return Math.min(100, (invoice.value.amount_paid / invoice.value.total) * 100)
})

const remaining = computed(() => {
  if (!invoice.value) return 0
  return invoice.value.total - invoice.value.amount_paid
})

function closeAllForms() {
  showLineItemForm.value = false
  showTaxForm.value = false
  showIssueForm.value = false
  showPaymentForm.value = false
  showVoidForm.value = false
}
</script>

<template>
  <AppLayout>
    <div class="detail-page">
      <!-- Back -->
      <button class="back-btn" @click="router.push('/invoices')">
        {{ t('invoiceDetail.backToInvoices') }}
      </button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('invoiceDetail.loadingInvoice') }}</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn" @click="fetchInvoice">{{ t('common.retry') }}</button>
      </div>

      <template v-else-if="invoice">
        <!-- Header -->
        <div class="detail-header">
          <div>
            <div class="detail-title-row">
              <h1 class="page-title">{{ t('invoiceDetail.invoiceTitle', { id: invoice.id.slice(0, 8) }) }}</h1>
              <StatusBadge :status="invoice.status" />
            </div>
            <p class="page-subtitle">{{ t('invoiceDetail.customer') }}: {{ invoice.customer_id }}</p>
          </div>
          <div class="header-total">
            <span class="total-label">{{ t('invoiceDetail.total') }}</span>
            <span class="total-amount">{{ formatMoney(invoice.total, invoice.currency) }}</span>
          </div>
        </div>

        <!-- Notification -->
        <div v-if="actionError" class="notification notification-error glass-card" @click="actionError = ''">
          {{ actionError }}
        </div>
        <div v-if="actionSuccess" class="notification notification-success glass-card" @click="actionSuccess = ''">
          {{ actionSuccess }}
        </div>

        <div class="detail-grid">
          <!-- Left: Invoice Info -->
          <div class="detail-main">
            <!-- Summary Cards -->
            <div class="summary-row">
              <div class="summary-card glass-card">
              <span class="summary-label">{{ t('invoiceDetail.subtotal') }}</span>
                <span class="summary-value">{{ formatMoney(invoice.subtotal, invoice.currency) }}</span>
              </div>
              <div class="summary-card glass-card">
              <span class="summary-label">{{ t('invoiceDetail.tax') }}</span>
                <span class="summary-value">{{ formatMoney(invoice.tax, invoice.currency) }}</span>
              </div>
              <div class="summary-card glass-card">
              <span class="summary-label">{{ t('invoiceDetail.paid') }}</span>
                <span class="summary-value paid-value">{{ formatMoney(invoice.amount_paid, invoice.currency) }}</span>
              </div>
              <div class="summary-card glass-card">
              <span class="summary-label">{{ t('invoiceDetail.balance') }}</span>
                <span class="summary-value balance-value">{{ formatMoney(remaining, invoice.currency) }}</span>
              </div>
            </div>

            <!-- Payment Progress -->
            <div v-if="invoice.status === 'issued' || invoice.status === 'paid'" class="progress-section glass-card">
              <div class="progress-header">
                <span class="progress-label">{{ t('invoiceDetail.paymentProgress') }}</span>
                <span class="progress-pct">{{ paymentProgress.toFixed(0) }}%</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: paymentProgress + '%' }"></div>
              </div>
            </div>

            <!-- Line Items -->
            <div class="line-items-section glass-card">
              <div class="section-header">
                <h2>{{ t('invoiceDetail.lineItems') }}</h2>
                <button
                  v-if="invoice.status === 'draft'"
                  class="action-btn accent-btn small-btn"
                  @click="showLineItemForm = !showLineItemForm"
                >
                  {{ showLineItemForm ? t('common.cancel') : t('invoiceDetail.addItem') }}
                </button>
              </div>

              <!-- Add Line Item Form -->
              <form v-if="showLineItemForm" class="inline-form" @submit.prevent="handleAddLineItem">
                <div class="form-row">
                  <div class="form-group flex-2">
                    <label>{{ t('invoiceDetail.description') }}</label>
                    <input v-model="newItem.description" type="text" :placeholder="t('invoiceDetail.itemDescPlaceholder')" required />
                  </div>
                  <div class="form-group">
                    <label>{{ t('invoiceDetail.qty') }}</label>
                    <input v-model.number="newItem.quantity" type="number" min="1" required />
                  </div>
                  <div class="form-group">
                    <label>{{ t('invoiceDetail.unitPrice') }} ($)</label>
                    <input v-model.number="newItem.unit_price" type="number" min="0" step="0.01" required />
                  </div>
                </div>
                <button class="action-btn primary-btn small-btn" type="submit" :disabled="actionLoading">
                  {{ actionLoading ? t('invoiceDetail.adding') : t('invoiceDetail.addLineItem') }}
                </button>
              </form>

              <!-- Items Table -->
              <table v-if="invoice.line_items && invoice.line_items.length > 0" class="items-table">
                <thead>
                  <tr>
                    <th>{{ t('invoiceDetail.description') }}</th>
                    <th class="text-right">{{ t('invoiceDetail.qty') }}</th>
                    <th class="text-right">{{ t('invoiceDetail.unitPrice') }}</th>
                    <th class="text-right">{{ t('invoiceDetail.total') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in invoice.line_items" :key="item.id">
                    <td>{{ item.description }}</td>
                    <td class="text-right">{{ item.quantity }}</td>
                    <td class="text-right">{{ formatMoney(item.unit_price, invoice.currency) }}</td>
                    <td class="text-right fw-600">{{ formatMoney(item.total, invoice.currency) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" class="text-right">{{ t('invoiceDetail.subtotal') }}</td>
                    <td class="text-right fw-600">{{ formatMoney(invoice.subtotal, invoice.currency) }}</td>
                  </tr>
                  <tr>
                    <td colspan="3" class="text-right">{{ t('invoiceDetail.tax') }}</td>
                    <td class="text-right fw-600">{{ formatMoney(invoice.tax, invoice.currency) }}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="3" class="text-right">{{ t('invoiceDetail.total') }}</td>
                    <td class="text-right fw-700">{{ formatMoney(invoice.total, invoice.currency) }}</td>
                  </tr>
                </tfoot>
              </table>

              <div v-else class="empty-items">
                <p>{{ t('invoiceDetail.noLineItems') }}</p>
              </div>
            </div>

            <!-- Dates -->
            <div class="dates-section glass-card">
              <h2>{{ t('invoiceDetail.timeline') }}</h2>
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot dot-default"></div>
                  <div class="timeline-content">
                    <span class="tl-label">{{ t('invoiceDetail.created') }}</span>
                    <span class="tl-value">{{ t('invoiceDetail.draft') }}</span>
                  </div>
                </div>
                <div v-if="invoice.issued_at" class="timeline-item">
                  <div class="timeline-dot dot-issued"></div>
                  <div class="timeline-content">
                    <span class="tl-label">{{ t('invoiceDetail.issued') }}</span>
                    <span class="tl-value">{{ formatDate(invoice.issued_at) }}</span>
                  </div>
                </div>
                <div v-if="invoice.due_at" class="timeline-item">
                  <div class="timeline-dot dot-due"></div>
                  <div class="timeline-content">
                    <span class="tl-label">{{ t('invoiceDetail.due') }}</span>
                    <span class="tl-value">{{ formatDate(invoice.due_at) }}</span>
                  </div>
                </div>
                <div v-if="invoice.paid_at" class="timeline-item">
                  <div class="timeline-dot dot-paid"></div>
                  <div class="timeline-content">
                    <span class="tl-label">{{ t('invoiceDetail.paidAt') }}</span>
                    <span class="tl-value">{{ formatDate(invoice.paid_at) }}</span>
                  </div>
                </div>
                <div v-if="invoice.void_reason" class="timeline-item">
                  <div class="timeline-dot dot-void"></div>
                  <div class="timeline-content">
                    <span class="tl-label">{{ t('invoiceDetail.voided') }}</span>
                    <span class="tl-value">{{ invoice.void_reason }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Actions Sidebar -->
          <div class="detail-sidebar">
            <div class="actions-card glass-card">
              <h3>{{ t('common.actions') }}</h3>

              <!-- Draft actions -->
              <template v-if="invoice.status === 'draft'">
              <button class="action-btn accent-btn" @click="showTaxForm = !showTaxForm">
                  {{ t('invoiceDetail.setTax') }}
                </button>
                <form v-if="showTaxForm" class="sidebar-form" @submit.prevent="handleSetTax">
                  <div class="form-group">
                    <label>{{ t('invoiceDetail.taxAmount') }}</label>
                    <input v-model.number="taxAmount" type="number" min="0" step="0.01" />
                  </div>
                  <button class="action-btn primary-btn small-btn" type="submit" :disabled="actionLoading">
                    {{ actionLoading ? t('invoiceDetail.saving') : t('invoiceDetail.saveTax') }}
                  </button>
                </form>

                <button class="action-btn primary-btn" @click="showIssueForm = !showIssueForm">
                  {{ t('invoiceDetail.issueInvoice') }}
                </button>
                <form v-if="showIssueForm" class="sidebar-form" @submit.prevent="handleIssue">
                  <div class="form-group">
                    <label>{{ t('invoiceDetail.dueDate') }}</label>
                    <input v-model="dueDate" type="date" />
                  </div>
                  <button class="action-btn primary-btn small-btn" type="submit" :disabled="actionLoading">
                    {{ actionLoading ? t('invoiceDetail.issuing') : t('invoiceDetail.confirmIssue') }}
                  </button>
                </form>
              </template>

              <!-- Issued actions -->
              <template v-if="invoice.status === 'issued'">
                <button class="action-btn primary-btn" @click="showPaymentForm = !showPaymentForm">
                  {{ t('invoiceDetail.recordPayment') }}
                </button>
                <form v-if="showPaymentForm" class="sidebar-form" @submit.prevent="handlePayment">
                  <div class="form-group">
                    <label>{{ t('invoiceDetail.paymentAmount') }}</label>
                    <input v-model.number="paymentAmount" type="number" min="0.01" step="0.01" />
                  </div>
                  <button class="action-btn primary-btn small-btn" type="submit" :disabled="actionLoading">
                    {{ actionLoading ? t('invoiceDetail.recording') : t('invoiceDetail.recordPayment') }}
                  </button>
                </form>
              </template>

              <!-- Void (draft or issued) -->
              <template v-if="invoice.status === 'draft' || invoice.status === 'issued'">
                <button class="action-btn danger-btn" @click="showVoidForm = !showVoidForm">
                  {{ t('invoiceDetail.voidInvoice') }}
                </button>
                <form v-if="showVoidForm" class="sidebar-form" @submit.prevent="handleVoid">
                  <div class="form-group">
                    <label>{{ t('invoiceDetail.voidReason') }}</label>
                    <input v-model="voidReason" type="text" :placeholder="t('invoiceDetail.voidReasonPlaceholder')" required />
                  </div>
                  <button class="action-btn danger-btn small-btn" type="submit" :disabled="actionLoading">
                    {{ actionLoading ? t('invoiceDetail.voiding') : t('invoiceDetail.confirmVoid') }}
                  </button>
                </form>
              </template>

              <!-- Paid / Void — no further actions -->
              <p v-if="invoice.status === 'paid'" class="no-actions">
                {{ t('invoiceDetail.invoiceFullyPaid') }}
              </p>
              <p v-if="invoice.status === 'void'" class="no-actions">
                {{ t('invoiceDetail.invoiceVoided') }}
              </p>
            </div>

            <!-- Info Card -->
            <div class="info-card glass-card">
              <h3>{{ t('invoiceDetail.details') }}</h3>
              <dl class="detail-list">
                <div class="dl-row">
                  <dt>{{ t('invoiceDetail.invoiceId') }}</dt>
                  <dd class="mono">{{ invoice.id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('invoiceDetail.customer') }}</dt>
                  <dd>{{ invoice.customer_id }}</dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('invoiceDetail.currencyLabel') }}</dt>
                  <dd>{{ invoice.currency.toUpperCase() }}</dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('adminNodeDetail.statusLabel') }}</dt>
                  <dd><StatusBadge :status="invoice.status" /></dd>
                </div>
                <div class="dl-row">
                  <dt>{{ t('invoiceDetail.billingCycle') }}</dt>
                  <dd>
                    <span class="cycle-badge" :class="'cycle-' + invoice.billing_cycle">
                      {{ billingCycleLabel(invoice.billing_cycle) }}
                    </span>
                  </dd>
                </div>
                <div v-if="invoice.period_start" class="dl-row">
                  <dt>{{ t('invoiceDetail.periodStart') }}</dt>
                  <dd>{{ formatDate(invoice.period_start) }}</dd>
                </div>
                <div v-if="invoice.period_end" class="dl-row">
                  <dt>{{ t('invoiceDetail.periodEnd') }}</dt>
                  <dd>{{ formatDate(invoice.period_end) }}</dd>
                </div>
              </dl>
            </div>

            <!-- Next Billing Card (recurring invoices only) -->
            <div v-if="invoice.next_billing_date" class="next-billing-card glass-card">
              <h3>{{ t('invoiceDetail.nextBilling') }}</h3>
              <div class="next-billing-content">
                <div class="next-billing-icon">⟳</div>
                <div class="next-billing-info">
                  <span class="next-billing-date">{{ formatDate(invoice.next_billing_date) }}</span>
                  <span class="next-billing-cycle">{{ billingCycleLabel(invoice.billing_cycle) }} {{ t('invoiceDetail.renewal') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped>
.detail-page {
  max-width: 1100px;
  margin: 0 auto;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1.25rem;
  transition: color 0.2s;
}

.back-btn:hover {
  color: var(--accent);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  background: none;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.header-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.total-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.total-amount {
  font-size: 2rem;
  font-weight: 800;
  color: var(--text-primary);
}

/* Notification */
.notification {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  cursor: pointer;
}

.notification-error {
  border-left: 3px solid var(--danger);
  color: var(--danger);
}

.notification-success {
  border-left: 3px solid var(--success);
  color: var(--success);
}

/* Grid */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

/* Summary */
.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

@media (max-width: 700px) {
  .summary-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.summary-card {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.paid-value { color: var(--success); }
.balance-value { color: var(--warning); }

/* Progress */
.progress-section {
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.progress-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.progress-pct {
  font-size: 0.85rem;
  color: var(--accent);
  font-weight: 600;
}

.progress-track {
  height: 8px;
  background: var(--bg-input);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  border-radius: 999px;
  transition: width 0.6s ease;
}

/* Line Items */
.line-items-section {
  padding: 1.5rem;
  margin-bottom: 1.25rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.inline-form {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 120px;
}

.form-group.flex-2 {
  flex: 2;
}

.form-group label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-group input {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

/* Items table */
.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--divider);
}

.items-table td {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
}

.items-table tfoot td {
  padding-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  border-bottom: none;
}

.items-table tfoot .total-row td {
  color: var(--text-primary);
  font-size: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--divider);
}

.text-right { text-align: right; }
.fw-600 { font-weight: 600; }
.fw-700 { font-weight: 700; }

.empty-items {
  text-align: center;
  padding: 1.5rem 0;
  color: var(--text-muted);
}

/* Dates / Timeline */
.dates-section {
  padding: 1.5rem;
}

.dates-section h2 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 1.5rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--bg-input);
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  position: relative;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: absolute;
  left: -1.5rem;
  top: 50%;
  transform: translate(0, -50%);
}

.dot-default { background: var(--bg-code); }
.dot-issued { background: var(--info-bg); }
.dot-due { background: var(--warning-bg); }
.dot-paid { background: var(--success-bg); }
.dot-void { background: var(--danger-bg); }

.timeline-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tl-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.tl-value {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

/* Right sidebar */
.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions-card {
  padding: 1.25rem;
}

.actions-card h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.actions-card .action-btn {
  margin-bottom: 0.5rem;
}

.sidebar-form {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.sidebar-form .form-group {
  margin-bottom: 0.5rem;
}

.no-actions {
  color: var(--text-muted);
  font-size: 0.875rem;
  margin: 0;
}

.info-card {
  padding: 1.25rem;
}

.info-card h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-list {
  margin: 0;
}

.dl-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--divider);
}

.dl-row:last-child {
  border-bottom: none;
}

.dl-row dt {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.dl-row dd {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-primary);
  text-align: right;
  max-width: 60%;
  word-break: break-all;
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
}

/* Billing cycle badge */
.cycle-badge {
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.cycle-one_time {
  background: var(--bg-code);
  color: var(--text-muted);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.cycle-monthly {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent-border);
}

.cycle-yearly {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

/* Next Billing Card */
.next-billing-card {
  padding: 1.25rem;
}

.next-billing-card h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.next-billing-content {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.next-billing-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: var(--success);
  flex-shrink: 0;
}

.next-billing-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.next-billing-date {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.next-billing-cycle {
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Loading / Error */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  color: var(--text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
