<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import {
  listAllProducts,
  enableProduct,
  disableProduct,
  updateProductPrice,
  updateProductNetworkMode,
  adjustProductStock
} from '../../api/admin'

const route = useRoute()
const router = useRouter()
const productID = route.params.id

const product = ref(null)
const loading = ref(true)
const error = ref('')

// Price edit
const editingPrice = ref(false)
const priceForm = ref({ amount: '', currency: '' })
const priceLoading = ref(false)
const priceError = ref('')
const priceSuccess = ref('')

// Network mode edit
const editingNetworkMode = ref(false)
const networkModeForm = ref({ mode: 'dedicated', natPortCount: 1 })
const networkModeLoading = ref(false)
const networkModeError = ref('')
const networkModeSuccess = ref('')

// Stock edit
const editingStock = ref(false)
const stockForm = ref({ totalSlots: 0, unlimited: false })
const stockLoading = ref(false)
const stockError = ref('')
const stockSuccess = ref('')

onMounted(fetchProduct)

async function fetchProduct() {
  loading.value = true
  error.value = ''
  try {
    const products = await listAllProducts()
    product.value = products.find(p => p.id === productID) || null
    if (!product.value) {
      error.value = 'Product not found'
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function toggleEnabled() {
  try {
    if (product.value.enabled) {
      await disableProduct(product.value.id)
      product.value.enabled = false
    } else {
      await enableProduct(product.value.id)
      product.value.enabled = true
    }
  } catch (err) {
    error.value = err.message
  }
}

function startEditPrice() {
  priceForm.value.amount = (product.value.price_amount / 100).toFixed(2)
  priceForm.value.currency = product.value.currency
  priceError.value = ''
  priceSuccess.value = ''
  editingPrice.value = true
}

async function savePrice() {
  priceError.value = ''
  priceSuccess.value = ''
  priceLoading.value = true
  try {
    const cents = Math.round(parseFloat(priceForm.value.amount) * 100)
    if (cents <= 0) throw new Error('Price must be greater than 0')
    await updateProductPrice(product.value.id, {
      amount: cents,
      currency: priceForm.value.currency
    })
    product.value.price_amount = cents
    product.value.currency = priceForm.value.currency
    priceSuccess.value = 'Price updated'
    editingPrice.value = false
  } catch (err) {
    priceError.value = err.message
  } finally {
    priceLoading.value = false
  }
}

function startEditNetworkMode() {
  networkModeForm.value.mode = product.value.network_mode || 'dedicated'
  networkModeForm.value.natPortCount = natPortCount(product.value)
  networkModeError.value = ''
  networkModeSuccess.value = ''
  editingNetworkMode.value = true
}

async function saveNetworkMode() {
  networkModeError.value = ''
  networkModeSuccess.value = ''
  networkModeLoading.value = true
  try {
    const count = Number(networkModeForm.value.natPortCount)
    if (networkModeForm.value.mode === 'nat' && (!Number.isInteger(count) || count < 1 || count > 1024)) {
      throw new Error('NAT port count must be between 1 and 1024')
    }
    const updated = await updateProductNetworkMode(product.value.id, networkModeForm.value.mode, networkModeForm.value.mode === 'nat' ? count : 1)
    product.value.network_mode = updated.network_mode
    product.value.nat_port_count = updated.nat_port_count || (networkModeForm.value.mode === 'nat' ? count : 1)
    networkModeSuccess.value = 'Network mode updated'
    editingNetworkMode.value = false
  } catch (err) {
    networkModeError.value = err.message
  } finally {
    networkModeLoading.value = false
  }
}

function startEditStock() {
  stockForm.value.unlimited = product.value.is_unlimited
  stockForm.value.totalSlots = product.value.is_unlimited ? 10 : product.value.total_slots
  stockError.value = ''
  stockSuccess.value = ''
  editingStock.value = true
}

async function saveStock() {
  stockError.value = ''
  stockSuccess.value = ''
  stockLoading.value = true
  try {
    const newTotal = stockForm.value.unlimited ? -1 : Number(stockForm.value.totalSlots)
    if (newTotal < -1) throw new Error('Total slots must be -1 (unlimited) or >= 0')
    const result = await adjustProductStock(product.value.id, newTotal)
    if (result.requires_confirmation && !result.saved) {
      const confirmed = confirm(result.warning_message || 'This stock level exceeds current physical capacity. Continue?')
      if (!confirmed) {
        stockError.value = 'Stock update cancelled'
        return
      }
    }
    const finalResult = result.requires_confirmation && !result.saved
      ? await adjustProductStock(product.value.id, newTotal, { confirmed: true })
      : result
    const updated = finalResult.data
    if (!updated) throw new Error('Invalid stock update response')
    product.value.total_slots = updated.total_slots
    product.value.sold_slots = updated.sold_slots
    product.value.available_slots = updated.available_slots
    product.value.is_unlimited = updated.is_unlimited
    stockSuccess.value = 'Stock updated'
    editingStock.value = false
  } catch (err) {
    stockError.value = err.message
  } finally {
    stockLoading.value = false
  }
}

function formatPrice(amount, currency) {
  return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
}

function formatCycle(cycle) {
  const map = { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' }
  return map[cycle] || cycle
}

function formatCycleShort(cycle) {
  const map = { monthly: '/mo', quarterly: '/qtr', annually: '/yr' }
  return map[cycle] || `/${cycle}`
}

function formatMemory(mb) {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`
}

function formatNetworkMode(mode) {
  return mode === 'nat' ? 'NAT Shared IP' : 'Dedicated Public IP'
}

function formatNetworkModeDesc(mode) {
  return mode === 'nat'
    ? 'Instances share the host public IP and access is exposed through NAT port mapping.'
    : 'Each instance is provisioned with its own dedicated public IP allocation.'
}

function natPortCount(target) {
  const count = Number(target?.nat_port_count)
  return Number.isInteger(count) && count > 0 ? count : 1
}

function natPortCountLabel(target) {
  const count = natPortCount(target)
  return `${count} ${count === 1 ? 'port' : 'ports'} per instance`
}

function networkPortCountValid() {
  const count = Number(networkModeForm.value.natPortCount)
  return networkModeForm.value.mode !== 'nat' || (Number.isInteger(count) && count >= 1 && count <= 1024)
}
</script>

<template>
  <AdminLayout>
    <div class="product-detail">
      <button class="back-btn" @click="router.push('/admin/products')">← Back to Products</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading product...</span>
      </div>

      <div v-else-if="error && !product" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchProduct">Retry</button>
      </div>

      <template v-else-if="product">
        <!-- Header -->
        <header class="product-header">
          <div>
            <h1 class="page-title">{{ product.name }}</h1>
            <p class="page-subtitle mono">{{ product.slug }}</p>
          </div>
          <div class="header-actions">
            <span class="status-badge" :class="product.enabled ? 'enabled' : 'disabled'">
              {{ product.enabled ? 'On Sale' : 'Disabled' }}
            </span>
            <button
              class="action-btn small-btn"
              :class="product.enabled ? 'danger-btn' : 'success-btn'"
              @click="toggleEnabled"
            >
              {{ product.enabled ? 'Take Off Sale' : 'Put On Sale' }}
            </button>
          </div>
        </header>

        <!-- Info Cards -->
        <div class="info-grid">
          <div class="info-card glass-card">
            <span class="info-label">Product ID</span>
            <span class="info-value mono">{{ product.id }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Location</span>
            <span class="info-value">📍 {{ product.location || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Billing Cycle</span>
            <span class="info-value">{{ formatCycle(product.billing_cycle) }}</span>
          </div>
          <div class="info-card glass-card highlight-card">
            <span class="info-label">Price</span>
            <span class="info-value price-value">
              {{ formatPrice(product.price_amount, product.currency) }}{{ formatCycleShort(product.billing_cycle) }}
            </span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Stock</span>
            <span class="info-value stock-value">
              <template v-if="product.is_unlimited">∞ <small>Unlimited</small></template>
              <template v-else>{{ product.available_slots }} <small>/ {{ product.total_slots }}</small></template>
            </span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Network</span>
            <span class="info-value">
              <span class="network-mode-inline" :class="product.network_mode === 'nat' ? 'nat' : 'dedicated'">
                {{ formatNetworkMode(product.network_mode) }}
              </span>
              <small v-if="product.network_mode === 'nat'" class="network-port-count-inline">{{ natPortCountLabel(product) }}</small>
            </span>
          </div>
        </div>

        <!-- Specs Section -->
        <section class="specs-section glass-card">
          <h2>Instance Specifications</h2>
          <p class="section-desc">Hardware resources allocated per instance of this plan</p>

          <div class="specs-detail-grid">
            <div class="spec-detail-item">
              <div class="spec-detail-icon">⚡</div>
              <div class="spec-detail-info">
                <span class="spec-detail-label">CPU Cores</span>
                <span class="spec-detail-value">{{ product.cpu }} vCPU</span>
              </div>
            </div>

            <div class="spec-detail-item">
              <div class="spec-detail-icon">◈</div>
              <div class="spec-detail-info">
                <span class="spec-detail-label">Memory</span>
                <span class="spec-detail-value">{{ formatMemory(product.memory_mb) }}</span>
              </div>
            </div>

            <div class="spec-detail-item">
              <div class="spec-detail-icon">▣</div>
              <div class="spec-detail-info">
                <span class="spec-detail-label">Disk Storage</span>
                <span class="spec-detail-value">{{ product.disk_gb }} GB NVMe</span>
              </div>
            </div>

            <div class="spec-detail-item">
              <div class="spec-detail-icon">↕</div>
              <div class="spec-detail-info">
                <span class="spec-detail-label">Bandwidth</span>
                <span class="spec-detail-value">{{ product.bandwidth_gb ? product.bandwidth_gb + ' GB' : 'Unlimited' }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="network-section glass-card">
          <div class="section-header">
            <div>
              <h2>Network / IP</h2>
              <p class="section-desc">Configure whether this product uses a dedicated public IP or shared NAT access</p>
            </div>
            <button v-if="!editingNetworkMode" class="action-btn accent-btn small-btn" @click="startEditNetworkMode">
              Edit Network
            </button>
            <button v-else class="action-btn secondary-btn small-btn" @click="editingNetworkMode = false">
              Cancel
            </button>
          </div>

          <div v-if="!editingNetworkMode" class="network-display">
            <div class="network-mode-banner" :class="product.network_mode === 'nat' ? 'nat' : 'dedicated'">
              <span class="network-mode-eyebrow">Current Mode</span>
              <strong>{{ formatNetworkMode(product.network_mode) }}</strong>
              <p>{{ formatNetworkModeDesc(product.network_mode) }}</p>
              <span v-if="product.network_mode === 'nat'" class="network-port-count">{{ natPortCountLabel(product) }}</span>
            </div>
          </div>

          <div v-else class="network-edit-form">
            <div class="network-mode-grid">
              <button
                type="button"
                class="network-mode-card"
                :class="{ active: networkModeForm.mode === 'dedicated' }"
                @click="networkModeForm.mode = 'dedicated'"
              >
                <div class="network-mode-card-top">
                  <span class="network-mode-pill dedicated">DEDICATED</span>
                  <span class="network-mode-check">{{ networkModeForm.mode === 'dedicated' ? '●' : '○' }}</span>
                </div>
                <strong>Dedicated Public IP</strong>
                <p>Each instance gets its own dedicated public IP allocation.</p>
              </button>

              <button
                type="button"
                class="network-mode-card nat"
                :class="{ active: networkModeForm.mode === 'nat' }"
                @click="networkModeForm.mode = 'nat'"
              >
                <div class="network-mode-card-top">
                  <span class="network-mode-pill nat">NAT</span>
                  <span class="network-mode-check">{{ networkModeForm.mode === 'nat' ? '●' : '○' }}</span>
                </div>
                <strong>NAT Shared IP</strong>
                <p>Instances share the host IP and use port mapping for external access.</p>
              </button>
            </div>

            <div v-if="networkModeForm.mode === 'nat'" class="nat-port-count-panel">
              <div class="form-group">
                <label>NAT Ports Per Instance</label>
                <div class="stepper">
                  <button type="button" class="stepper-btn" @click="networkModeForm.natPortCount = Math.max(1, networkModeForm.natPortCount - 1)">−</button>
                  <input
                    v-model.number="networkModeForm.natPortCount"
                    type="number"
                    min="1"
                    max="1024"
                    class="form-input stepper-input"
                  />
                  <button type="button" class="stepper-btn" @click="networkModeForm.natPortCount = Math.min(1024, networkModeForm.natPortCount + 1)">+</button>
                </div>
                <span class="form-hint-note">Allocated as one contiguous NAT port block for each new instance.</span>
              </div>
            </div>

            <div class="network-edit-actions">
              <button
                class="action-btn primary-btn"
                :disabled="networkModeLoading || !networkPortCountValid()"
                @click="saveNetworkMode"
              >
                {{ networkModeLoading ? 'Saving...' : 'Save Network' }}
              </button>
            </div>
            <p v-if="networkModeError" class="form-error">{{ networkModeError }}</p>
          </div>
          <p v-if="networkModeSuccess" class="form-success">{{ networkModeSuccess }}</p>
        </section>

        <!-- Update Price Section -->
        <section class="price-section glass-card">
          <div class="section-header">
            <div>
              <h2>Pricing</h2>
              <p class="section-desc">Current price for this product</p>
            </div>
            <button v-if="!editingPrice" class="action-btn accent-btn small-btn" @click="startEditPrice">
              Edit Price
            </button>
            <button v-else class="action-btn secondary-btn small-btn" @click="editingPrice = false">
              Cancel
            </button>
          </div>

          <div v-if="!editingPrice" class="current-price-display">
            <div class="big-price">
              <span class="big-currency">{{ product.currency }}</span>
              <span class="big-amount">{{ (product.price_amount / 100).toFixed(2) }}</span>
              <span class="big-cycle">{{ formatCycleShort(product.billing_cycle) }}</span>
            </div>
          </div>

          <div v-else class="price-edit-form">
            <div class="form-row">
              <div class="form-group">
                <label>Currency</label>
                <select v-model="priceForm.currency" class="form-select">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label>Amount</label>
                <input
                  v-model="priceForm.amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  class="form-input"
                  placeholder="9.99"
                />
              </div>
              <div class="form-group form-group-btn">
                <label>&nbsp;</label>
                <button
                  class="action-btn primary-btn"
                  :disabled="priceLoading"
                  @click="savePrice"
                >
                  {{ priceLoading ? 'Saving...' : 'Save Price' }}
                </button>
              </div>
            </div>
            <p v-if="priceError" class="form-error">{{ priceError }}</p>
          </div>
          <p v-if="priceSuccess" class="form-success">{{ priceSuccess }}</p>
        </section>

        <!-- Stock / Inventory Section -->
        <section class="stock-section glass-card">
          <div class="section-header">
            <div>
              <h2>Inventory / Stock</h2>
              <p class="section-desc">Manage available slots for this product</p>
            </div>
            <button v-if="!editingStock" class="action-btn accent-btn small-btn" @click="startEditStock">
              Edit Stock
            </button>
            <button v-else class="action-btn secondary-btn small-btn" @click="editingStock = false">
              Cancel
            </button>
          </div>

          <div v-if="!editingStock" class="stock-display">
            <div class="stock-stat">
              <span class="stock-stat-label">Total Slots</span>
              <span class="stock-stat-value">{{ product.is_unlimited ? '∞' : product.total_slots }}</span>
            </div>
            <div class="stock-stat">
              <span class="stock-stat-label">Sold</span>
              <span class="stock-stat-value sold">{{ product.sold_slots }}</span>
            </div>
            <div class="stock-stat">
              <span class="stock-stat-label">Available</span>
              <span class="stock-stat-value available">{{ product.is_unlimited ? '∞' : product.available_slots }}</span>
            </div>
            <div v-if="!product.is_unlimited && product.total_slots > 0" class="stock-bar-wrapper">
              <div class="stock-bar-track">
                <div
                  class="stock-bar-fill"
                  :style="{ width: `${(product.sold_slots / product.total_slots) * 100}%` }"
                ></div>
              </div>
              <span class="stock-bar-label">
                {{ ((product.sold_slots / product.total_slots) * 100).toFixed(1) }}% sold
              </span>
            </div>
            <div v-else-if="product.is_unlimited" class="stock-bar-wrapper">
              <span class="stock-bar-label unlimited-label">Unlimited — no cap on instances ({{ product.sold_slots }} sold)</span>
            </div>
          </div>

          <div v-else class="stock-edit-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Total Slots</label>
                <label class="unlimited-toggle">
                  <input type="checkbox" v-model="stockForm.unlimited" />
                  <span>Unlimited</span>
                </label>
                <div v-if="!stockForm.unlimited" class="stepper">
                  <button type="button" class="stepper-btn" @click="stockForm.totalSlots = Math.max(0, stockForm.totalSlots - 1)">−</button>
                  <input
                    v-model.number="stockForm.totalSlots"
                    type="number"
                    min="0"
                    class="form-input stepper-input"
                  />
                  <button type="button" class="stepper-btn" @click="stockForm.totalSlots++">+</button>
                </div>
                <div v-else class="unlimited-badge">∞ No cap on instances</div>
              </div>
              <div class="form-group form-group-btn">
                <label>&nbsp;</label>
                <button
                  class="action-btn primary-btn"
                  :disabled="stockLoading"
                  @click="saveStock"
                >
                  {{ stockLoading ? 'Saving...' : 'Save Stock' }}
                </button>
              </div>
            </div>
            <p class="form-hint-note">Sold slots: {{ product.sold_slots }}. {{ stockForm.unlimited ? 'Unlimited mode — no slot limit.' : 'Positive total must be ≥ sold slots.' }}</p>
            <p v-if="stockError" class="form-error">{{ stockError }}</p>
          </div>
          <p v-if="stockSuccess" class="form-success">{{ stockSuccess }}</p>
        </section>
      </template>
    </div>
  </AdminLayout>
</template>

<style scoped>
.product-detail {
  max-width: 900px;
  margin: 0 auto;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1rem;
  transition: color 0.2s;
}
.back-btn:hover { color: var(--text-primary); }

/* Loading / Error */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Header */
.product-header {
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
  color: var(--text-muted);
  font-size: 0.9rem;
}

.mono { font-family: monospace; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  display: inline-flex;
  padding: 0.25rem 0.7rem;
  border-radius: 6px;
  font-size: 0.75rem;
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

.danger-btn {
  background: var(--danger-bg) !important;
  border-color: var(--danger-border) !important;
  color: #f87171 !important;
}
.danger-btn:hover {
  background: var(--danger-bg) !important;
}

.success-btn {
  background: var(--success-bg) !important;
  border-color: var(--success-border) !important;
  color: #4ade80 !important;
}
.success-btn:hover {
  background: var(--success-bg) !important;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

@media (max-width: 720px) {
  .info-grid { grid-template-columns: 1fr 1fr; }
}

.info-card {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.info-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.highlight-card {
  border-color: var(--danger);
}

.price-value {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.1rem;
}

.network-mode-inline {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.28rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  border: 1px solid transparent;
}

.network-mode-inline.dedicated {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.22);
}

.network-mode-inline.nat {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.22);
}

/* Specs Section */
.specs-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.specs-section h2 {
  margin: 0 0 0.2rem;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.section-desc {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0 0 1.25rem;
}

.specs-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

@media (max-width: 720px) {
  .specs-detail-grid { grid-template-columns: 1fr 1fr; }
}

.spec-detail-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 12px;
}

.spec-detail-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  border-radius: 10px;
  flex-shrink: 0;
}

.spec-detail-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.spec-detail-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.spec-detail-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.network-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.network-section h2 {
  margin: 0 0 0.2rem;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.network-mode-banner {
  border-radius: 16px;
  padding: 1.15rem 1.25rem;
  border: 1px solid rgba(248, 113, 113, 0.2);
  background:
    linear-gradient(135deg, rgba(248, 113, 113, 0.12), rgba(15, 23, 42, 0.08)),
    var(--bg-card);
}

.network-mode-banner.nat {
  border-color: rgba(251, 191, 36, 0.22);
  background:
    linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(15, 23, 42, 0.08)),
    var(--bg-card);
}

.network-mode-eyebrow {
  display: inline-block;
  margin-bottom: 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.network-mode-banner strong {
  display: block;
  font-size: 1.05rem;
  margin-bottom: 0.35rem;
}

.network-mode-banner p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.5;
}

.network-port-count,
.network-port-count-inline {
  display: inline-flex;
  margin-top: 0.55rem;
  color: #fcd34d;
  font-size: 0.78rem;
  font-weight: 700;
}

.network-port-count-inline {
  margin-top: 0.4rem;
}

.network-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.network-mode-card {
  text-align: left;
  border: 1px solid var(--border-default);
  border-radius: 16px;
  padding: 1rem;
  background:
    linear-gradient(180deg, rgba(248, 113, 113, 0.05), rgba(15, 23, 42, 0.08)),
    var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.network-mode-card:hover {
  transform: translateY(-1px);
  border-color: rgba(248, 113, 113, 0.35);
}

.network-mode-card.active {
  border-color: rgba(248, 113, 113, 0.55);
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.12);
}

.network-mode-card.nat {
  background:
    linear-gradient(180deg, rgba(251, 191, 36, 0.06), rgba(15, 23, 42, 0.08)),
    var(--bg-card);
}

.network-mode-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.network-mode-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  border: 1px solid transparent;
}

.network-mode-pill.dedicated {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.14);
  border-color: rgba(248, 113, 113, 0.2);
}

.network-mode-pill.nat {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.14);
  border-color: rgba(251, 191, 36, 0.2);
}

.network-mode-check {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.network-mode-card.active .network-mode-check {
  color: #f87171;
}

.network-mode-card strong {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
}

.network-mode-card p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.network-edit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.nat-port-count-panel {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
}

/* Price Section */
.price-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}

.price-section h2 {
  margin: 0 0 0.2rem;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.current-price-display {
  display: flex;
  align-items: center;
}

.big-price {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.big-currency {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.big-amount {
  font-size: 2.5rem;
  font-weight: 800;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.big-cycle {
  font-size: 1rem;
  color: var(--text-muted);
}

/* Price Edit */
.price-edit-form .form-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group.flex-1 { flex: 1; }

.form-group.form-group-btn {
  flex-shrink: 0;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input, .form-select {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input::placeholder { color: var(--text-muted); }
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, currentColor 50%),
    linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-repeat: no-repeat;
  background-position:
    calc(100% - 1rem) 50%,
    calc(100% - 0.7rem) 50%;
  background-size: 6px 6px, 6px 6px;
  padding-right: 2rem;
}

.form-select option {
  background: var(--bg-base);
  color: var(--text-primary);
}

.form-error {
  margin: 0.75rem 0 0;
  padding: 0.6rem 0.75rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  color: var(--danger);
  font-size: 0.85rem;
}

.form-success {
  margin: 0.75rem 0 0;
  padding: 0.6rem 0.75rem;
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  border-radius: 8px;
  color: var(--success);
  font-size: 0.85rem;
}

/* Stock value in info grid */
.stock-value {
  color: var(--accent);
  font-size: 1.1rem;
}
.stock-value small {
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Stock Section */
.stock-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.stock-section h2 {
  margin: 0 0 0.2rem;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.stock-display {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stock-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 12px;
}

.stock-stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}

.stock-stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text-primary);
}

.stock-stat-value.sold {
  color: var(--warning);
}

.stock-stat-value.available {
  color: var(--success);
}

.stock-bar-wrapper {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stock-bar-track {
  flex: 1;
  height: 10px;
  background: var(--bg-input);
  border-radius: 5px;
  overflow: hidden;
}

.stock-bar-fill {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #6366f1, #818cf8);
  transition: width 0.3s ease;
}

.stock-bar-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: monospace;
  white-space: nowrap;
}

.unlimited-label {
  font-family: inherit;
  color: var(--text-muted);
  font-style: italic;
}

/* Unlimited toggle & badge */
.unlimited-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  font-size: 0.82rem !important;
  color: var(--text-secondary) !important;
  user-select: none;
}

.unlimited-toggle input[type="checkbox"] {
  accent-color: #6366f1;
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.unlimited-badge {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 0.85rem;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid var(--accent-border);
  border-radius: 10px;
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
  font-style: italic;
}

/* Stock Edit */
.stock-edit-form .form-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.form-hint-note {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* Stepper */
.stepper {
  display: flex;
  gap: 0;
}

.stepper-btn {
  width: 38px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stepper-btn:first-child { border-radius: 10px 0 0 10px; border-right: none; }
.stepper-btn:last-child { border-radius: 0 10px 10px 0; border-left: none; }
.stepper-btn:hover { background: var(--bg-card-hover); color: var(--text-primary); }

.stepper-input {
  border-radius: 0;
  text-align: center;
  width: 70px;
  -moz-appearance: textfield;
}
.stepper-input::-webkit-inner-spin-button,
.stepper-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

@media (max-width: 720px) {
  .network-mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
