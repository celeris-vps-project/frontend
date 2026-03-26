<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { listInvoices, formatMoney, formatDate, billingCycleLabel } from '../api/billing.js'
import { isAdmin } from '../api/auth.js'

const { t } = useI18n()
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
          <h1 class="page-title">{{ t('invoices.title') }}</h1>
          <p class="page-subtitle">{{ t('invoices.subtitle') }}</p>
        </div>
        <router-link v-if="isAdmin()" to="/invoices/create" class="action-btn primary-btn small-btn">
          {{ t('invoices.newInvoice') }}
        </router-link>
      </header>

      <div class="filters glass-card">
        <div class="filter-tabs">
          <button
            v-for="status in ['all', 'draft', 'issued', 'paid', 'void']"
            :key="status"
            class="filter-tab"
            :class="{ active: filterStatus === status }"
            @click="filterStatus = status"
          >
            {{ status === 'all' ? t('invoices.all') : t('status.' + status) }}
            <span class="count-badge">{{ statusCounts[status] }}</span>
          </button>
        </div>
        <div class="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="searchQuery" type="text" :placeholder="t('invoices.searchPlaceholder')" class="search-input" />
        </div>
      </div>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('invoices.loadingInvoices') }}</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchInvoices">{{ t('common.retry') }}</button>
      </div>

      <div v-else-if="filteredInvoices.length === 0" class="empty-state glass-card">
        <p>{{ t('invoices.noMatch') }}</p>
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
              <span v-for="li in (inv.line_items || []).slice(0, 3)" :key="li.id" class="line-item-tag">
                {{ li.description }}
              </span>
              <span v-if="(inv.line_items || []).length > 3" class="line-item-tag more">
                {{ t('invoices.moreItems', { count: inv.line_items.length - 3 }) }}
              </span>
              <span v-if="!inv.line_items || inv.line_items.length === 0" class="no-items">
                {{ t('invoices.noItems') }}
              </span>
            </div>
          </div>

          <div class="invoice-card-bottom">
            <div class="invoice-dates">
              <span v-if="inv.billing_cycle && inv.billing_cycle !== 'one_time'" class="cycle-badge">
                {{ billingCycleLabel(inv.billing_cycle) }}
              </span>
              <span v-if="inv.issued_at">{{ t('invoiceDetail.issued') }} {{ formatDate(inv.issued_at) }}</span>
              <span v-if="inv.due_at" class="due-date">{{ t('invoiceDetail.due') }} {{ formatDate(inv.due_at) }}</span>
            </div>
            <div class="invoice-total">{{ formatMoney(inv.total, inv.currency) }}</div>
          </div>

          <div v-if="inv.status === 'issued' && inv.total > 0" class="payment-progress">
            <div class="payment-bar" :style="{ width: Math.min(100, (inv.amount_paid / inv.total) * 100) + '%' }"></div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.invoices-page { max-width: 1100px; margin: 0 auto; }

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;
}

.page-title { margin: 0; font-size: 1.75rem; font-weight: 700; color: var(--text-primary); }
.page-subtitle { margin: 0.25rem 0 0; color: var(--text-muted); font-size: 0.9rem; }

.filters {
  padding: 1rem 1.25rem; margin-bottom: 1.5rem;
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 1rem;
}

.filter-tabs { display: flex; gap: 0.25rem; }

.filter-tab {
  padding: 0.4rem 0.8rem; border: 1px solid transparent; border-radius: 10px;
  background: none; color: var(--text-muted); font-size: 0.82rem;
  cursor: pointer; text-transform: capitalize; transition: all 0.2s;
  display: flex; align-items: center; gap: 0.35rem;
}

.filter-tab:hover { background: var(--sidebar-hover-bg); color: var(--text-primary); }
.filter-tab.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-border); }

.count-badge {
  font-size: 0.68rem; background: var(--bg-code); padding: 0.1rem 0.4rem;
  border-radius: 999px; font-weight: 600;
}
.filter-tab.active .count-badge { background: var(--accent-bg-hover); }

.search-box {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--bg-input); border: 1px solid var(--border-default);
  border-radius: 10px; padding: 0.4rem 0.75rem;
}
.search-input {
  background: none; border: none; outline: none;
  color: var(--text-primary); font-size: 0.85rem; width: 180px;
}
.search-input::placeholder { color: var(--text-muted); }

.invoice-list { display: flex; flex-direction: column; gap: 0.75rem; }

.invoice-card {
  padding: 1.25rem; cursor: pointer; transition: all 0.25s;
  position: relative; overflow: hidden;
}
.invoice-card:hover {
  transform: translateY(-1px); background: var(--bg-card-hover);
  box-shadow: var(--glass-shadow);
}

.invoice-card-top {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.75rem;
}
.invoice-id-col { display: flex; flex-direction: column; gap: 0.15rem; }
.invoice-hash {
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: var(--accent); font-weight: 600; font-size: 0.95rem;
}
.invoice-customer { color: var(--text-muted); font-size: 0.8rem; }

.invoice-card-body { margin-bottom: 0.75rem; }
.line-items-preview { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.line-item-tag {
  padding: 0.2rem 0.6rem; background: var(--bg-code);
  border: 1px solid var(--border-default); border-radius: 6px;
  font-size: 0.75rem; color: var(--text-secondary);
}
.line-item-tag.more {
  color: var(--accent); border-color: var(--accent-border);
  background: var(--accent-bg);
}
.no-items { font-size: 0.8rem; color: var(--text-muted); font-style: italic; }

.invoice-card-bottom {
  display: flex; justify-content: space-between; align-items: center;
}
.invoice-dates {
  display: flex; gap: 1rem; font-size: 0.78rem; color: var(--text-muted);
}
.due-date { color: var(--warning); }
.cycle-badge {
  padding: 0.1rem 0.5rem; background: var(--accent-bg);
  border: 1px solid var(--accent-border); border-radius: 6px;
  font-size: 0.7rem; color: var(--accent); font-weight: 600;
  text-transform: uppercase;
}
.invoice-total { font-size: 1.15rem; font-weight: 700; color: var(--text-primary); }

.payment-progress {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: 3px; background: var(--border-subtle);
}
.payment-bar {
  height: 100%; background: var(--accent-gradient);
  border-radius: 0 2px 0 0; transition: width 0.5s ease;
}

.loading-state, .empty-state, .error-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem 1.5rem; color: var(--text-muted);
}

.spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--border-default);
  border-top-color: var(--spinner-color);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
