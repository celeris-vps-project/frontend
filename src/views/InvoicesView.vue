<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { listInvoices, formatMoney, formatDate, billingCycleLabel } from '../api/billing.js'

const router = useRouter()
const invoices = ref([])
const loading = ref(true)
const error = ref('')
const filterStatus = ref('all')
const searchQuery = ref('')

onMounted(fetchInvoices)

async function fetchInvoices() {
  loading.value = true
  error.value = ''
  try {
    invoices.value = await listInvoices()
  } catch (err) {
    error.value = err.message
    invoices.value = []
  } finally {
    loading.value = false
  }
}

const filteredInvoices = computed(() => {
  let results = invoices.value
  if (filterStatus.value !== 'all') {
    results = results.filter(i => i.status === filterStatus.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    results = results.filter(i =>
      i.id.toLowerCase().includes(q) ||
      (i.line_items || []).some(li => li.description.toLowerCase().includes(q))
    )
  }
  return results
})

const statusCounts = computed(() => {
  const counts = { all: invoices.value.length, draft: 0, issued: 0, paid: 0, void: 0 }
  invoices.value.forEach(i => {
    if (counts[i.status] !== undefined) counts[i.status]++
  })
  return counts
})

function goToInvoice(id) {
  router.push(`/invoices/${id}`)
}
</script>

<template>
  <AppLayout>
    <div class="invoices-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Invoices</h1>
          <p class="page-subtitle">Manage all your VPS billing invoices</p>
        </div>
        <router-link to="/invoices/create" class="action-btn primary-btn">
          <span>✦</span> New Invoice
        </router-link>
      </header>

      <!-- Filters -->
      <div class="filters glass-card">
        <div class="filter-tabs">
          <button
            v-for="status in ['all', 'draft', 'issued', 'paid', 'void']"
            :key="status"
            class="filter-tab"
            :class="{ active: filterStatus === status }"
            @click="filterStatus = status"
          >
            {{ status }}
            <span class="count-badge">{{ statusCounts[status] }}</span>
          </button>
        </div>
        <div class="search-box">
          <span class="search-icon">⌕</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search invoices..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Invoice List -->
      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading invoices...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn" @click="fetchInvoices">Retry</button>
      </div>

      <div v-else-if="filteredInvoices.length === 0" class="empty-state glass-card">
        <div class="empty-icon">◈</div>
        <p>No invoices match your filters.</p>
        <router-link v-if="invoices.length === 0" to="/invoices/create" class="action-btn primary-btn">
          Create Invoice
        </router-link>
      </div>

      <div v-else class="invoice-list">
        <div
          v-for="inv in filteredInvoices"
          :key="inv.id"
          class="invoice-card glass-card"
          @click="goToInvoice(inv.id)"
        >
          <div class="invoice-card-top">
            <div class="invoice-id-col">
              <span class="invoice-hash">#{{ inv.id.slice(0, 8) }}</span>
              <span class="invoice-customer">{{ inv.customer_id }}</span>
            </div>
            <StatusBadge :status="inv.status" />
          </div>

          <div class="invoice-card-body">
            <div class="line-items-preview">
              <span
                v-for="(li, idx) in (inv.line_items || []).slice(0, 3)"
                :key="li.id"
                class="line-item-tag"
              >
                {{ li.description }}
              </span>
              <span
                v-if="(inv.line_items || []).length > 3"
                class="line-item-tag more"
              >
                +{{ inv.line_items.length - 3 }} more
              </span>
              <span v-if="!inv.line_items || inv.line_items.length === 0" class="no-items">
                No line items
              </span>
            </div>
          </div>

          <div class="invoice-card-bottom">
            <div class="invoice-dates">
              <span v-if="inv.billing_cycle && inv.billing_cycle !== 'one_time'" class="cycle-badge">
                {{ billingCycleLabel(inv.billing_cycle) }}
              </span>
              <span v-if="inv.issued_at">Issued {{ formatDate(inv.issued_at) }}</span>
              <span v-if="inv.due_at" class="due-date">Due {{ formatDate(inv.due_at) }}</span>
              <span v-if="inv.next_billing_date" class="next-billing">
                Next billing {{ formatDate(inv.next_billing_date) }}
              </span>
            </div>
            <div class="invoice-total">
              {{ formatMoney(inv.total, inv.currency) }}
            </div>
          </div>

          <!-- Payment progress bar for issued invoices -->
          <div v-if="inv.status === 'issued' && inv.total > 0" class="payment-progress">
            <div
              class="payment-bar"
              :style="{ width: Math.min(100, (inv.amount_paid / inv.total) * 100) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.invoices-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
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

/* Filters */
.filters {
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.filter-tab {
  padding: 0.45rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.825rem;
  cursor: pointer;
  text-transform: capitalize;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.filter-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
}

.filter-tab.active {
  background: rgba(99, 102, 241, 0.15);
  color: #a78bfa;
  border-color: rgba(99, 102, 241, 0.2);
}

.count-badge {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
}

.filter-tab.active .count-badge {
  background: rgba(99, 102, 241, 0.25);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
}

.search-icon {
  color: rgba(255, 255, 255, 0.35);
  font-size: 1.1rem;
}

.search-input {
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 0.875rem;
  width: 200px;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* Invoice cards */
.invoice-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.invoice-card {
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}

.invoice-card:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.08);
}

.invoice-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.invoice-id-col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.invoice-hash {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #a78bfa;
  font-weight: 600;
  font-size: 0.95rem;
}

.invoice-customer {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
}

.invoice-card-body {
  margin-bottom: 0.75rem;
}

.line-items-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.line-item-tag {
  padding: 0.2rem 0.6rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.775rem;
  color: rgba(255, 255, 255, 0.6);
}

.line-item-tag.more {
  color: #a78bfa;
  border-color: rgba(99, 102, 241, 0.2);
  background: rgba(99, 102, 241, 0.1);
}

.no-items {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}

.invoice-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.invoice-dates {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

.due-date {
  color: rgba(251, 191, 36, 0.7);
}

.cycle-badge {
  padding: 0.1rem 0.5rem;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 6px;
  font-size: 0.7rem;
  color: #a78bfa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.next-billing {
  color: rgba(74, 222, 128, 0.7);
}

.invoice-total {
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
}

/* Payment progress */
.payment-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.05);
}

.payment-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a78bfa);
  border-radius: 0 2px 0 0;
  transition: width 0.5s ease;
}

/* States */
.loading-state,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.2);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
