<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import {
  listAllProducts,
  enableProduct,
  disableProduct,
  updateProductPrice,
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
    const updated = await adjustProductStock(product.value.id, newTotal)
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
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1rem;
  transition: color 0.2s;
}
.back-btn:hover { color: #fff; }

/* Loading / Error */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.5);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
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
  background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: rgba(255, 255, 255, 0.4);
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
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.status-badge.disabled {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.danger-btn {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
  color: #f87171 !important;
}
.danger-btn:hover {
  background: rgba(239, 68, 68, 0.25) !important;
}

.success-btn {
  background: rgba(34, 197, 94, 0.15) !important;
  border-color: rgba(34, 197, 94, 0.3) !important;
  color: #4ade80 !important;
}
.success-btn:hover {
  background: rgba(34, 197, 94, 0.25) !important;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.04em;
}

.info-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
}

.highlight-card {
  border-color: rgba(248, 113, 113, 0.2);
}

.price-value {
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 1.1rem;
}

/* Specs Section */
.specs-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.specs-section h2 {
  margin: 0 0 0.2rem;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
}

.section-desc {
  color: rgba(255, 255, 255, 0.4);
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.spec-detail-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.1);
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
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.04em;
}

.spec-detail-value {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
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
  color: rgba(255, 255, 255, 0.9);
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
  color: rgba(255, 255, 255, 0.5);
}

.big-amount {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.big-cycle {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.4);
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
  color: rgba(255, 255, 255, 0.55);
  font-weight: 500;
}

.form-input, .form-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font-size: 0.9rem;
  color: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input::placeholder { color: rgba(255, 255, 255, 0.25); }
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0l5 6 5-6' fill='rgba(255,255,255,0.4)'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.8rem center;
  padding-right: 2rem;
}

.form-select option {
  background: #1a1a2e;
  color: #fff;
}

.form-error {
  margin: 0.75rem 0 0;
  padding: 0.6rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #f87171;
  font-size: 0.85rem;
}

.form-success {
  margin: 0.75rem 0 0;
  padding: 0.6rem 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  color: #4ade80;
  font-size: 0.85rem;
}

/* Stock value in info grid */
.stock-value {
  color: #818cf8;
  font-size: 1.1rem;
}
.stock-value small {
  font-weight: 400;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Stock Section */
.stock-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.stock-section h2 {
  margin: 0 0 0.2rem;
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
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
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.stock-stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.04em;
}

.stock-stat-value {
  font-size: 1.5rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
}

.stock-stat-value.sold {
  color: #fbbf24;
}

.stock-stat-value.available {
  color: #4ade80;
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
  background: rgba(255, 255, 255, 0.06);
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
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  white-space: nowrap;
}

.unlimited-label {
  font-family: inherit;
  color: rgba(255, 255, 255, 0.45);
  font-style: italic;
}

/* Unlimited toggle & badge */
.unlimited-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  font-size: 0.82rem !important;
  color: rgba(255, 255, 255, 0.65) !important;
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
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
  color: #818cf8;
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
  color: rgba(255, 255, 255, 0.35);
}

/* Stepper */
.stepper {
  display: flex;
  gap: 0;
}

.stepper-btn {
  width: 38px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stepper-btn:first-child { border-radius: 10px 0 0 10px; border-right: none; }
.stepper-btn:last-child { border-radius: 0 10px 10px 0; border-left: none; }
.stepper-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }

.stepper-input {
  border-radius: 0;
  text-align: center;
  width: 70px;
  -moz-appearance: textfield;
}
.stepper-input::-webkit-inner-spin-button,
.stepper-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
</style>
