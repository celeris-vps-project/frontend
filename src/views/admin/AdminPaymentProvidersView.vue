<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import {
  listPaymentProviders,
  enablePaymentProvider,
  disablePaymentProvider,
  deletePaymentProvider,
  formatDateTime
} from '../../api/admin'

const { t } = useI18n()
const router = useRouter()
const providers = ref([])
const loading = ref(true)
const error = ref('')
const filter = ref('all')
const search = ref('')

onMounted(fetchProviders)

async function fetchProviders() {
  loading.value = true
  error.value = ''
  try {
    providers.value = await listPaymentProviders()
  } catch (err) {
    error.value = err.message
    providers.value = []
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = providers.value
  if (filter.value === 'enabled') list = list.filter(p => p.enabled)
  if (filter.value === 'disabled') list = list.filter(p => !p.enabled)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    )
  }
  return list
})

const typeIcons = {
  crypto_usdt: '₮',
  stripe: '💳',
  paypal: '🅿',
  alipay: '🔵',
  wechat_pay: '💚',
  custom: '🔧',
}

const typeColors = {
  crypto_usdt: '#26a17b',
  stripe: '#635bff',
  paypal: '#003087',
  alipay: '#1677ff',
  wechat_pay: '#07c160',
  custom: '#ff6b35',
}

function typeIcon(type) { return typeIcons[type] || '💰' }
function typeColor(type) { return typeColors[type] || '#888' }

async function toggleProvider(p) {
  try {
    if (p.enabled) {
      await disablePaymentProvider(p.id)
    } else {
      await enablePaymentProvider(p.id)
    }
    p.enabled = !p.enabled
  } catch (err) {
    error.value = err.message
  }
}

async function removeProvider(p) {
  if (!confirm(`Delete provider "${p.name}"? This action cannot be undone.`)) return
  try {
    await deletePaymentProvider(p.id)
    providers.value = providers.value.filter(x => x.id !== p.id)
  } catch (err) {
    error.value = err.message
  }
}

function goToCreate() {
  router.push('/admin/payment-providers/new')
}

function goToEdit(p) {
  router.push(`/admin/payment-providers/${p.id}/edit`)
}
</script>

<template>
  <AdminLayout>
    <div class="providers-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ t('adminPayment.title') }}</h1>
          <p class="page-subtitle">{{ t('adminPayment.subtitle') }}</p>
        </div>
        <button class="header-add-btn" @click="goToCreate">
          <span class="header-add-icon">+</span>
          {{ t('adminPayment.newProvider') }}
        </button>
      </header>

      <!-- Filters -->
      <div class="filter-bar glass-card">
        <div class="filter-tabs">
          <button
            v-for="f in ['all', 'enabled', 'disabled']"
            :key="f"
            class="filter-tab"
            :class="{ active: filter === f }"
            @click="filter = f"
          >
            {{ t(`adminPayment.${f}`) }}
          </button>
        </div>
        <input
          v-model="search"
          type="text"
          class="search-input"
          :placeholder="t('adminPayment.searchPlaceholder')"
        />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="glass-card loading-state">
        <div class="spinner"></div>
        <span>{{ t('adminPayment.loadingProviders') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="glass-card error-state">
        <p class="error-text">{{ error }}</p>
        <button class="action-btn secondary-btn" @click="fetchProviders">{{ t('common.retry') }}</button>
      </div>

      <!-- Empty -->
      <div v-else-if="filtered.length === 0" class="glass-card empty-state">
        <p v-if="search || filter !== 'all'">{{ t('adminPayment.noMatch') }}</p>
        <div v-else>
          <p>{{ t('adminPayment.noProviders') }}</p>
          <button class="action-btn primary-btn" @click="goToCreate">
            {{ t('adminPayment.addFirstProvider') }}
          </button>
        </div>
      </div>

      <!-- Provider List -->
      <div v-else class="provider-grid">
        <div
          v-for="p in filtered"
          :key="p.id"
          class="provider-card glass-card"
          :style="{ '--provider-color': typeColor(p.type) }"
        >
          <div class="provider-header">
            <div class="provider-icon" :style="{ background: typeColor(p.type) + '22', color: typeColor(p.type) }">
              {{ typeIcon(p.type) }}
            </div>
            <div class="provider-info">
              <span class="provider-name">{{ p.name }}</span>
              <span class="provider-type">{{ p.type }}</span>
            </div>
            <span class="status-badge" :class="p.enabled ? 'enabled' : 'disabled'">
              {{ p.enabled ? t('adminPayment.enabled') : t('adminPayment.disabled') }}
            </span>
          </div>

          <div class="provider-meta">
            <div class="meta-row">
              <span class="meta-label">ID</span>
              <span class="meta-value mono">{{ p.id?.substring(0, 8) }}...</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('adminPayment.sortOrder') }}</span>
              <span class="meta-value">{{ p.sort_order }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('adminPayment.created') }}</span>
              <span class="meta-value">{{ formatDateTime(p.created_at) }}</span>
            </div>
          </div>

          <!-- Config summary -->
          <div v-if="p.type === 'crypto_usdt' && p.config?.wallets" class="config-summary">
            <span class="config-label">{{ t('adminPayment.networks') }}:</span>
            <span
              v-for="net in Object.keys(p.config.wallets)"
              :key="net"
              class="network-tag"
            >{{ net }}</span>
          </div>

          <!-- Custom provider: show webhook URL -->
          <div v-if="p.type === 'custom' && p.config?.notify_url" class="config-summary webhook-summary">
            <span class="config-label">{{ t('adminPayment.webhookUrl') }}:</span>
            <code class="webhook-url">{{ p.config.notify_url }}</code>
          </div>

          <div class="provider-actions">
            <button class="action-btn small-btn edit-btn" @click="goToEdit(p)">
              {{ t('common.edit') }}
            </button>
            <button
              class="action-btn small-btn"
              :class="p.enabled ? 'warning-btn' : 'success-btn'"
              @click="toggleProvider(p)"
            >
              {{ p.enabled ? t('adminPayment.disable') : t('adminPayment.enable') }}
            </button>
            <button class="action-btn small-btn danger-btn" @click="removeProvider(p)">
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.providers-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}

.header-add-btn:hover {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent);
}

.header-add-icon {
  font-size: 1.1rem;
  font-weight: 300;
  line-height: 1;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.filter-tab {
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover { background: var(--bg-input); }
.filter-tab.active {
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 600;
}

.search-input {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.82rem;
  min-width: 220px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus { border-color: var(--accent); }

/* Provider Grid */
.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

.provider-card {
  padding: 1.25rem;
  border-radius: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 3px solid var(--provider-color);
}

.provider-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.provider-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  flex-shrink: 0;
}

.provider-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.provider-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-type {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.status-badge {
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.status-badge.enabled {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.status-badge.disabled {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.provider-meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta-label {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.meta-value {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.meta-value.mono {
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 0.75rem;
}

.config-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-input);
  border-radius: 8px;
}

.config-label {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 500;
}

.network-tag {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 600;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.webhook-summary {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.webhook-url {
  font-size: 0.72rem;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  color: var(--accent);
  word-break: break-all;
  background: transparent;
}

.provider-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid var(--divider);
}

/* States */
.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
  text-align: center;
}

.error-text { color: var(--danger); }

.spinner {
  width: 28px; height: 28px;
  border: 2px solid var(--border-default);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Buttons */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 1.1rem;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
}

.primary-btn {
  background: var(--accent-gradient);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}
.primary-btn:hover { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4); transform: translateY(-1px); }

.secondary-btn {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.small-btn {
  padding: 0.35rem 0.7rem;
  font-size: 0.75rem;
}

.success-btn {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.warning-btn {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.danger-btn {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.edit-btn {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent);
}

.edit-btn:hover {
  background: var(--accent);
  color: #fff;
}

.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  backdrop-filter: blur(20px);
}
</style>
