<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import { listAllProducts, enableProduct, disableProduct } from '../../api/admin'

const { t } = useI18n()
const router = useRouter()
const products = ref([])
const loading = ref(true)
const error = ref('')
const filterStatus = ref('all')
const searchQuery = ref('')

onMounted(fetchProducts)

async function fetchProducts() {
  loading.value = true
  error.value = ''
  try {
    products.value = await listAllProducts()
  } catch (err) {
    error.value = err.message
    products.value = []
  } finally {
    loading.value = false
  }
}

const filteredProducts = computed(() => {
  let results = products.value
  if (filterStatus.value === 'enabled') {
    results = results.filter(p => p.enabled)
  } else if (filterStatus.value === 'disabled') {
    results = results.filter(p => !p.enabled)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      formatNetworkMode(p.network_mode).toLowerCase().includes(q)
    )
  }
  return results
})

const statusCounts = computed(() => {
  const all = products.value
  return {
    all: all.length,
    enabled: all.filter(p => p.enabled).length,
    disabled: all.filter(p => !p.enabled).length
  }
})

const filterTabs = computed(() => [
  { key: 'all', label: t('adminProducts.all') },
  { key: 'enabled', label: t('adminProducts.onSale') },
  { key: 'disabled', label: t('adminProducts.disabled') }
])

function formatPrice(amount, currency) {
  const value = (amount / 100).toFixed(2)
  return `${currency.toUpperCase()} ${value}`
}

function formatCycle(cycle) {
  const map = { monthly: '/mo', quarterly: '/qtr', annually: '/yr' }
  return map[cycle] || `/${cycle}`
}

function formatNetworkMode(mode) {
  return mode === 'nat' ? t('adminProducts.networkNat') : t('adminProducts.networkDedicated')
}

function natPortCount(product) {
  const count = Number(product?.nat_port_count)
  return Number.isInteger(count) && count > 0 ? count : 1
}

async function toggleEnabled(product) {
  try {
    if (product.enabled) {
      await disableProduct(product.id)
      product.enabled = false
    } else {
      await enableProduct(product.id)
      product.enabled = true
    }
  } catch (err) {
    error.value = err.message
  }
}

function goToProduct(id) {
  router.push(`/admin/products/${id}`)
}
</script>

<template>
  <AdminLayout>
    <div class="products-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ t('adminProducts.title') }}</h1>
          <p class="page-subtitle">{{ t('adminProducts.subtitle') }}</p>
        </div>
        <router-link to="/admin/products/new" class="action-btn primary-btn small-btn">
          {{ t('adminProducts.newProduct') }}
        </router-link>
      </header>

      <!-- Filters -->
      <div class="filters glass-card">
        <div class="filter-tabs">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            class="filter-tab"
            :class="{ active: filterStatus === tab.key }"
            @click="filterStatus = tab.key"
          >
            {{ tab.label }}
            <span class="count-badge">{{ statusCounts[tab.key] }}</span>
          </button>
        </div>
        <div class="search-box">
          <span class="search-icon">⌕</span>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('adminProducts.searchPlaceholder')"
            class="search-input"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>{{ t('adminProducts.loadingProducts') }}</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchProducts">{{ t('common.retry') }}</button>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredProducts.length === 0" class="empty-state glass-card">
        <div class="empty-icon">◇</div>
        <p>{{ t('adminProducts.noMatch') }}</p>
        <router-link v-if="products.length === 0" to="/admin/products/new" class="action-btn primary-btn small-btn">
          {{ t('adminProducts.createFirst') }}
        </router-link>
      </div>

      <!-- Product Cards -->
      <div v-else class="product-list">
        <div
          v-for="product in filteredProducts"
          :key="product.id"
          class="product-card glass-card"
          @click="goToProduct(product.id)"
        >
          <div class="product-card-top">
            <div class="product-name-col">
              <span class="product-name">{{ product.name }}</span>
              <span class="product-slug">{{ product.slug }}</span>
              <div class="product-meta-row">
                <span class="network-badge" :class="product.network_mode === 'nat' ? 'nat' : 'dedicated'">
                  {{ formatNetworkMode(product.network_mode) }}
                </span>
                <span v-if="product.network_mode === 'nat'" class="network-badge nat-count">
                  NAT x{{ natPortCount(product) }}
                </span>
              </div>
              <span v-if="product.location" class="product-location">📍 {{ product.location }}</span>
            </div>
            <div class="product-status-col">
              <span class="status-badge" :class="product.enabled ? 'enabled' : 'disabled'">
                {{ product.enabled ? t('adminProducts.onSale') : t('adminProducts.disabled') }}
              </span>
              <button
                class="toggle-btn"
                :class="product.enabled ? 'on' : 'off'"
                @click.stop="toggleEnabled(product)"
                :title="product.enabled ? 'Disable product' : 'Enable product'"
              >
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </button>
            </div>
          </div>

          <div class="product-card-body">
            <div class="specs-grid">
              <div class="spec-item">
                <span class="spec-label">CPU</span>
                <span class="spec-value">{{ product.cpu }} <small>vCPU</small></span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Memory</span>
                <span class="spec-value">{{ product.memory_mb >= 1024 ? (product.memory_mb / 1024) + ' GB' : product.memory_mb + ' MB' }}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Disk</span>
                <span class="spec-value">{{ product.disk_gb }} <small>GB</small></span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Bandwidth</span>
                <span class="spec-value">{{ product.bandwidth_gb ? product.bandwidth_gb + ' GB' : '∞' }}</span>
              </div>
            </div>
          </div>

          <div class="product-card-bottom">
            <span class="product-price">{{ formatPrice(product.price_amount, product.currency) }}{{ formatCycle(product.billing_cycle) }}</span>
            <span class="product-stock">
              <template v-if="product.is_unlimited">
                <span class="stock-avail">{{ t('adminProducts.unlimited') }}</span>
              </template>
              <template v-else>
                <span class="stock-avail">{{ product.available_slots }}</span> / {{ product.total_slots }} {{ t('adminProducts.slots') }}
              </template>
            </span>
            <span class="product-id mono">{{ product.id.substring(0, 8) }}…</span>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.products-page {
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

/* Filters */
.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.filter-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.825rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.filter-tab.active {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.count-badge {
  background: var(--bg-input);
  padding: 0.1rem 0.45rem;
  border-radius: 6px;
  font-size: 0.7rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
}

.search-icon { color: var(--text-muted); font-size: 0.9rem; }

.search-input {
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  width: 200px;
}
.search-input::placeholder { color: var(--text-muted); }

/* Loading / Error / Empty */
.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.empty-icon { font-size: 2.5rem; opacity: 0.3; }

.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Product Cards */
.product-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

.product-card {
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.2s;
}
.product-card:hover {
  border-color: var(--text-muted);
  transform: translateY(-1px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.product-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.product-name-col { display: flex; flex-direction: column; gap: 0.15rem; }
.product-name {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 1.05rem;
}
.product-slug {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-family: monospace;
}

.product-location {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.1rem;
}

.product-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.35rem;
}

.network-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}

.network-badge.dedicated {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.22);
}

.network-badge.nat {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.22);
}

.network-badge.nat-count {
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
}

.product-status-col {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.status-badge {
  display: inline-flex;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.status-badge.enabled {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}
.status-badge.disabled {
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border-default);
}

/* Toggle Switch */
.toggle-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.toggle-track {
  display: flex;
  align-items: center;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  padding: 2px;
  transition: background 0.2s;
}

.toggle-btn.on .toggle-track {
  background: var(--success-bg);
}

.toggle-btn.off .toggle-track {
  background: var(--bg-card-hover);
}

.toggle-thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle-btn.on .toggle-thumb {
  transform: translateX(16px);
}

.toggle-btn.off .toggle-thumb {
  transform: translateX(0);
}

/* Specs */
.specs-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.spec-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.6rem 0.4rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}

.spec-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.spec-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}
.spec-value small {
  font-weight: 400;
  font-size: 0.7rem;
  color: var(--text-muted);
}

/* Bottom */
.product-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--divider);
}

.product-price {
  font-size: 1rem;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.product-stock {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.stock-avail {
  font-weight: 700;
  color: var(--success);
}

.product-id {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.mono { font-family: monospace; }
</style>
