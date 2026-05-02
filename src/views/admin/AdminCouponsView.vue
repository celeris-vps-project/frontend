<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import {
  createCoupon,
  disableCoupon,
  enableCoupon,
  listAllProducts,
  listCoupons,
  formatDateTime
} from '../../api/admin'

const { t } = useI18n()

const coupons = ref([])
const products = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const search = ref('')
const filter = ref('all')
const productSearch = ref('')
const selectedProducts = ref([])

const form = reactive({
  code: '',
  discount_type: 'free',
  discount_value: 0,
  starts_at: '',
  expires_at: '',
  max_redemptions: 100,
  per_user_limit: 1,
  description: ''
})

onMounted(loadPage)

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    const [couponRows, productRows] = await Promise.all([
      listCoupons(),
      listAllProducts()
    ])
    coupons.value = couponRows
    products.value = productRows
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const productByID = computed(() => {
  const map = {}
  for (const product of products.value) map[product.id] = product
  return map
})

const filteredProducts = computed(() => {
  const q = productSearch.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.slug.toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q)
  )
})

const filteredCoupons = computed(() => {
  let list = coupons.value
  if (filter.value === 'enabled') list = list.filter(c => c.enabled)
  if (filter.value === 'disabled') list = list.filter(c => !c.enabled)
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    )
  }
  return list
})

const counts = computed(() => ({
  all: coupons.value.length,
  enabled: coupons.value.filter(c => c.enabled).length,
  disabled: coupons.value.filter(c => !c.enabled).length
}))

const canCreate = computed(() => {
  if (saving.value) return false
  if (!form.code.trim()) return false
  if (selectedProducts.value.length === 0) return false
  if (Number(form.max_redemptions) !== -1 && Number(form.max_redemptions) <= 0) return false
  if (Number(form.per_user_limit) < 0) return false
  if (form.discount_type === 'fixed' && Number(form.discount_value) <= 0) return false
  if (form.discount_type === 'percent') {
    const value = Number(form.discount_value)
    if (value <= 0 || value > 100) return false
  }
  return true
})

function toggleProduct(productID) {
  if (selectedProducts.value.includes(productID)) {
    selectedProducts.value = selectedProducts.value.filter(id => id !== productID)
  } else {
    selectedProducts.value = [...selectedProducts.value, productID]
  }
}

function normalizeCode() {
  form.code = form.code.trim().toUpperCase()
}

function toRFC3339(value) {
  if (!value) return undefined
  return new Date(value).toISOString()
}

function resetForm() {
  form.code = ''
  form.discount_type = 'free'
  form.discount_value = 0
  form.starts_at = ''
  form.expires_at = ''
  form.max_redemptions = 100
  form.per_user_limit = 1
  form.description = ''
  selectedProducts.value = []
  productSearch.value = ''
}

async function submitCreate() {
  if (!canCreate.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      max_redemptions: Number(form.max_redemptions),
      per_user_limit: Number(form.per_user_limit),
      description: form.description.trim(),
      allowed_product_ids: selectedProducts.value
    }
    const startsAt = toRFC3339(form.starts_at)
    const expiresAt = toRFC3339(form.expires_at)
    if (startsAt) payload.starts_at = startsAt
    if (expiresAt) payload.expires_at = expiresAt

    const created = await createCoupon(payload)
    coupons.value = [created, ...coupons.value]
    resetForm()
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function toggleCoupon(coupon) {
  try {
    if (coupon.enabled) {
      await disableCoupon(coupon.id)
    } else {
      await enableCoupon(coupon.id)
    }
    coupon.enabled = !coupon.enabled
  } catch (err) {
    error.value = err.message
  }
}

function formatDiscount(coupon) {
  if (coupon.discount_type === 'free') return t('adminCoupons.discountFree')
  if (coupon.discount_type === 'percent') return `${coupon.discount_value}%`
  return formatPrice(coupon.discount_value, 'USD')
}

function formatPrice(amount, currency) {
  return `${currency} ${(Number(amount || 0) / 100).toFixed(2)}`
}

function redemptionText(coupon) {
  const max = Number(coupon.max_redemptions)
  if (max === -1) return `${coupon.used_count} / ${t('adminCoupons.unlimited')}`
  return `${coupon.used_count} / ${max}`
}

function productLabel(productID) {
  const product = productByID.value[productID]
  if (!product) return productID
  return product.name || product.slug || product.id
}
</script>

<template>
  <AdminLayout>
    <div class="coupons-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">{{ t('adminCoupons.title') }}</h1>
          <p class="page-subtitle">{{ t('adminCoupons.subtitle') }}</p>
        </div>
      </header>

      <div v-if="error" class="error-banner">
        <span>{{ error }}</span>
        <button type="button" @click="error = ''">×</button>
      </div>

      <section class="create-panel glass-card">
        <div class="panel-header">
          <h2>{{ t('adminCoupons.createTitle') }}</h2>
        </div>

        <form class="coupon-form" @submit.prevent="submitCreate">
          <div class="form-grid">
            <label class="form-field">
              <span>{{ t('adminCoupons.code') }}</span>
              <input
                v-model="form.code"
                type="text"
                autocomplete="off"
                :placeholder="t('adminCoupons.codePlaceholder')"
                @blur="normalizeCode"
              />
            </label>

            <label class="form-field">
              <span>{{ t('adminCoupons.discountType') }}</span>
              <select v-model="form.discount_type">
                <option value="free">{{ t('adminCoupons.typeFree') }}</option>
                <option value="percent">{{ t('adminCoupons.typePercent') }}</option>
                <option value="fixed">{{ t('adminCoupons.typeFixed') }}</option>
              </select>
            </label>

            <label class="form-field">
              <span>{{ t('adminCoupons.discountValue') }}</span>
              <input
                v-model.number="form.discount_value"
                type="number"
                min="0"
                :max="form.discount_type === 'percent' ? 100 : undefined"
                :disabled="form.discount_type === 'free'"
              />
            </label>

            <label class="form-field">
              <span>{{ t('adminCoupons.maxRedemptions') }}</span>
              <input v-model.number="form.max_redemptions" type="number" min="-1" />
            </label>

            <label class="form-field">
              <span>{{ t('adminCoupons.perUserLimit') }}</span>
              <input v-model.number="form.per_user_limit" type="number" min="0" />
            </label>

            <label class="form-field">
              <span>{{ t('adminCoupons.startsAt') }}</span>
              <input v-model="form.starts_at" type="datetime-local" />
            </label>

            <label class="form-field">
              <span>{{ t('adminCoupons.expiresAt') }}</span>
              <input v-model="form.expires_at" type="datetime-local" />
            </label>

            <label class="form-field form-field-wide">
              <span>{{ t('adminCoupons.description') }}</span>
              <input v-model="form.description" type="text" :placeholder="t('adminCoupons.descriptionPlaceholder')" />
            </label>
          </div>

          <div class="product-picker">
            <div class="picker-head">
              <span>{{ t('adminCoupons.allowedProducts') }}</span>
              <input v-model="productSearch" type="text" :placeholder="t('adminCoupons.productSearch')" />
            </div>
            <div class="product-options">
              <button
                v-for="product in filteredProducts"
                :key="product.id"
                type="button"
                class="product-option"
                :class="{ selected: selectedProducts.includes(product.id) }"
                @click="toggleProduct(product.id)"
              >
                <span class="product-name">{{ product.name }}</span>
                <span class="product-meta">{{ product.slug }} · {{ formatPrice(product.price_amount, product.currency) }}</span>
              </button>
            </div>
          </div>

          <div class="form-actions">
            <span class="selected-count">{{ t('adminCoupons.selectedProducts', { count: selectedProducts.length }) }}</span>
            <button class="action-btn primary-btn" type="submit" :disabled="!canCreate">
              {{ saving ? t('adminCoupons.creating') : t('adminCoupons.createCoupon') }}
            </button>
          </div>
        </form>
      </section>

      <section class="list-panel">
        <div class="filter-bar glass-card">
          <div class="filter-tabs">
            <button
              v-for="f in ['all', 'enabled', 'disabled']"
              :key="f"
              class="filter-tab"
              :class="{ active: filter === f }"
              @click="filter = f"
            >
              {{ t(`adminCoupons.${f}`) }}
              <span class="count-badge">{{ counts[f] }}</span>
            </button>
          </div>
          <input v-model="search" class="search-input" type="text" :placeholder="t('adminCoupons.searchPlaceholder')" />
        </div>

        <div v-if="loading" class="glass-card state-card">
          <div class="spinner"></div>
          <span>{{ t('adminCoupons.loadingCoupons') }}</span>
        </div>

        <div v-else-if="filteredCoupons.length === 0" class="glass-card state-card">
          <span>{{ t('adminCoupons.noCoupons') }}</span>
        </div>

        <div v-else class="coupon-grid">
          <article v-for="coupon in filteredCoupons" :key="coupon.id" class="coupon-card glass-card">
            <div class="coupon-top">
              <div>
                <div class="coupon-code mono">{{ coupon.code }}</div>
                <div class="coupon-desc">{{ coupon.description || t('common.none') }}</div>
              </div>
              <span class="status-badge" :class="coupon.enabled ? 'enabled' : 'disabled'">
                {{ coupon.enabled ? t('adminCoupons.enabled') : t('adminCoupons.disabled') }}
              </span>
            </div>

            <div class="coupon-metrics">
              <div>
                <span>{{ t('adminCoupons.discount') }}</span>
                <strong>{{ formatDiscount(coupon) }}</strong>
              </div>
              <div>
                <span>{{ t('adminCoupons.usage') }}</span>
                <strong>{{ redemptionText(coupon) }}</strong>
              </div>
              <div>
                <span>{{ t('adminCoupons.perUserLimit') }}</span>
                <strong>{{ coupon.per_user_limit }}</strong>
              </div>
            </div>

            <div class="product-tags">
              <span
                v-for="productID in coupon.allowed_product_ids"
                :key="productID"
                class="product-tag"
              >
                {{ productLabel(productID) }}
              </span>
            </div>

            <div class="coupon-footer">
              <span class="date-text">{{ formatDateTime(coupon.expires_at) }}</span>
              <button
                class="action-btn small-btn"
                :class="coupon.enabled ? 'warning-btn' : 'success-btn'"
                @click="toggleCoupon(coupon)"
              >
                {{ coupon.enabled ? t('adminCoupons.disable') : t('adminCoupons.enable') }}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.coupons-page {
  max-width: 1120px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
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

.error-banner {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--danger-border);
  background: var(--danger-bg);
  color: var(--danger);
}

.error-banner button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
}

.create-panel {
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.05rem;
}

.coupon-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-field-wide {
  grid-column: span 2;
}

.form-field span,
.picker-head span {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-field input,
.form-field select,
.picker-head input,
.search-input {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.85rem;
  padding: 0.58rem 0.7rem;
  outline: none;
}

.form-field input:focus,
.form-field select:focus,
.picker-head input:focus,
.search-input:focus {
  border-color: var(--accent);
}

.form-field input:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}

.product-picker {
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.85rem;
  background: var(--bg-card);
}

.picker-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.picker-head input {
  max-width: 260px;
}

.product-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.5rem;
  max-height: 220px;
  overflow: auto;
}

.product-option {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.product-option.selected {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.product-name {
  font-weight: 700;
  font-size: 0.85rem;
}

.product-meta {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.selected-count {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
}

.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.82rem;
  padding: 0.42rem 0.8rem;
}

.filter-tab.active {
  background: var(--accent-bg);
  color: var(--accent);
}

.count-badge {
  background: var(--bg-input);
  border-radius: 6px;
  padding: 0.08rem 0.4rem;
  font-size: 0.68rem;
}

.coupon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
  gap: 1rem;
}

.coupon-card {
  padding: 1.1rem;
}

.coupon-top,
.coupon-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.coupon-code {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: 800;
}

.coupon-desc,
.date-text {
  color: var(--text-muted);
  font-size: 0.76rem;
}

.coupon-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin: 1rem 0;
}

.coupon-metrics div {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.6rem;
  border-radius: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
}

.coupon-metrics span {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.coupon-metrics strong {
  color: var(--text-primary);
  font-size: 0.9rem;
}

.product-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-height: 28px;
  margin-bottom: 0.9rem;
}

.product-tag {
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 0.7rem;
  padding: 0.18rem 0.48rem;
}

.status-badge {
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.22rem 0.55rem;
  text-transform: uppercase;
}

.status-badge.enabled {
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  color: var(--success);
}

.status-badge.disabled {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
}

.state-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-secondary);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--border-default);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.58rem 1rem;
}

.primary-btn {
  background: var(--accent-gradient);
  color: var(--text-primary);
}

.primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.small-btn {
  font-size: 0.74rem;
  padding: 0.36rem 0.7rem;
}

.success-btn {
  background: var(--success-bg);
  border: 1px solid var(--success-border);
  color: var(--success);
}

.warning-btn {
  background: var(--warning-bg);
  border: 1px solid var(--warning-border);
  color: var(--warning);
}

.mono {
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  backdrop-filter: blur(20px);
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-field-wide {
    grid-column: span 1;
  }

  .filter-bar,
  .picker-head,
  .form-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .picker-head input {
    max-width: none;
  }
}
</style>
