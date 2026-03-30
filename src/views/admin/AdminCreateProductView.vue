<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import { createProduct, listResourcePools, listAllRegions } from '../../api/admin'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const pools = ref([])
const regions = ref([])
const poolsLoading = ref(false)

const unlimitedStock = ref(false)

const form = ref({
  name: '',
  slug: '',
  resource_pool_id: '',
  network_mode: 'dedicated',
  cpu: 1,
  memory_mb: 1024,
  disk_gb: 25,
  bandwidth_gb: 1000,
  price_amount: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  total_slots: 10
})

onMounted(async () => {
  poolsLoading.value = true
  try {
    const [poolsData, regionsData] = await Promise.all([
      listResourcePools(),
      listAllRegions()
    ])
    pools.value = poolsData
    regions.value = regionsData
  } catch (e) {
    console.error('Failed to load data', e)
  } finally {
    poolsLoading.value = false
  }
})

const selectedPool = computed(() => {
  return pools.value.find(p => p.pool_id === form.value.resource_pool_id)
})

const selectedRegion = computed(() => {
  if (!selectedPool.value) return null
  return regions.value.find(r => r.id === selectedPool.value.region_id)
})

// Auto-generate slug from name
watch(() => form.value.name, (name) => {
  form.value.slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
})

const billingCycles = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' }
]

const memoryOptions = [
  { value: 512, label: '512 MB' },
  { value: 1024, label: '1 GB' },
  { value: 2048, label: '2 GB' },
  { value: 4096, label: '4 GB' },
  { value: 8192, label: '8 GB' },
  { value: 16384, label: '16 GB' },
  { value: 32768, label: '32 GB' },
  { value: 65536, label: '64 GB' }
]

const networkModeOptions = [
  { value: 'dedicated', badge: 'DEDICATED' },
  { value: 'nat', badge: 'NAT' }
]

const priceInCents = computed(() => {
  const val = parseFloat(form.value.price_amount)
  if (isNaN(val) || val <= 0) return 0
  return Math.round(val * 100)
})

const formValid = computed(() => {
  return form.value.name
    && form.value.slug
    && form.value.resource_pool_id
    && form.value.cpu > 0
    && form.value.memory_mb > 0
    && form.value.disk_gb > 0
    && priceInCents.value > 0
    && form.value.currency
    && form.value.billing_cycle
    && (unlimitedStock.value || form.value.total_slots >= 0)
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const region = selectedRegion.value
    const pool = selectedPool.value
    const payload = {
      name: form.value.name,
      slug: form.value.slug,
      location: region ? region.name : '',
      region_id: pool ? pool.region_id : '',
      resource_pool_id: form.value.resource_pool_id,
      network_mode: form.value.network_mode,
      cpu: Number(form.value.cpu),
      memory_mb: Number(form.value.memory_mb),
      disk_gb: Number(form.value.disk_gb),
      bandwidth_gb: Number(form.value.bandwidth_gb),
      price_amount: priceInCents.value,
      currency: form.value.currency,
      billing_cycle: form.value.billing_cycle,
      total_slots: unlimitedStock.value ? -1 : Number(form.value.total_slots)
    }
    const product = await createProduct(payload)
    router.push(`/admin/products/${product.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="create-product-page">
      <button class="back-btn" @click="router.push('/admin/products')">{{ t('adminCreateProduct.backToProducts') }}</button>

      <header class="page-header">
        <h1 class="page-title">{{ t('adminCreateProduct.title') }}</h1>
        <p class="page-subtitle">{{ t('adminCreateProduct.subtitle') }}</p>
      </header>

      <form @submit.prevent="handleSubmit">
        <!-- Product Identity -->
        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminCreateProduct.productInfo') }}</h2>
          <div class="form-grid">
            <div class="form-group">
              <label>{{ t('adminCreateProduct.productName') }}</label>
              <input v-model="form.name" type="text" :placeholder="t('adminCreateProduct.productNamePlaceholder')" required class="form-input" />
              <span class="form-hint">{{ t('adminCreateProduct.productNameHint') }}</span>
            </div>
            <div class="form-group">
              <label>{{ t('adminCreateProduct.slug') }}</label>
              <input v-model="form.slug" type="text" :placeholder="t('adminCreateProduct.slugPlaceholder')" required class="form-input mono" />
              <span class="form-hint">{{ t('adminCreateProduct.slugHint') }}</span>
            </div>
            <div class="form-group full-width">
              <label>{{ t('adminCreateProduct.resourcePool') }}</label>
              <select v-model="form.resource_pool_id" required class="form-select" :disabled="poolsLoading">
                <option value="" disabled>{{ poolsLoading ? t('adminCreateProduct.loadingResourcePools') : t('adminCreateProduct.selectResourcePool') }}</option>
                <option v-for="pool in pools" :key="pool.pool_id" :value="pool.pool_id">
                  {{ pool.pool_name }}
                </option>
              </select>
              <span v-if="selectedRegion" class="form-hint">{{ t('adminCreateProduct.regionHint', { region: selectedRegion.name }) }}</span>
              <span v-else class="form-hint">{{ t('adminCreateProduct.selectPoolHint') }}</span>
            </div>
          </div>
        </section>

        <!-- Instance Specs -->
        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminCreateProduct.instanceSpecs') }}</h2>
          <p class="section-desc">{{ t('adminCreateProduct.instanceSpecsDesc') }}</p>

          <div class="form-grid four-col">
            <div class="form-group">
              <label>{{ t('adminCreateProduct.cpuCores') }}</label>
              <div class="stepper">
                <button type="button" class="stepper-btn" @click="form.cpu = Math.max(1, form.cpu - 1)">−</button>
                <input v-model.number="form.cpu" type="number" min="1" max="128" class="form-input stepper-input" />
                <button type="button" class="stepper-btn" @click="form.cpu++">+</button>
              </div>
              <span class="form-hint">{{ t('adminCreateProduct.cpuCoresHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateProduct.memoryLabel') }}</label>
              <select v-model.number="form.memory_mb" class="form-select">
                <option v-for="opt in memoryOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <span class="form-hint">{{ t('adminCreateProduct.memoryHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateProduct.diskLabel') }}</label>
              <input v-model.number="form.disk_gb" type="number" min="5" step="5" class="form-input" />
              <span class="form-hint">{{ t('adminCreateProduct.diskHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateProduct.bandwidthLabel') }}</label>
              <input v-model.number="form.bandwidth_gb" type="number" min="0" step="100" class="form-input" />
              <span class="form-hint">{{ t('adminCreateProduct.bandwidthHint') }}</span>
            </div>
          </div>

          <!-- Visual summary -->
          <div class="spec-summary">
            <div class="spec-pill"><strong>{{ form.cpu }}</strong> vCPU</div>
            <div class="spec-pill"><strong>{{ form.memory_mb >= 1024 ? (form.memory_mb / 1024) + ' GB' : form.memory_mb + ' MB' }}</strong> RAM</div>
            <div class="spec-pill"><strong>{{ form.disk_gb }} GB</strong> Disk</div>
            <div class="spec-pill network-pill">
              <strong>{{ form.network_mode === 'nat' ? 'NAT' : 'Dedicated' }}</strong>
              {{ form.network_mode === 'nat' ? 'Shared IP' : 'Public IP' }}
            </div>
            <div class="spec-pill"><strong>{{ form.bandwidth_gb || '∞' }}</strong> {{ form.bandwidth_gb ? 'GB BW' : 'Bandwidth' }}</div>
          </div>
        </section>

        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminCreateProduct.networkSection') }}</h2>
          <p class="section-desc">{{ t('adminCreateProduct.networkSectionDesc') }}</p>

          <div class="network-mode-grid">
            <button
              v-for="option in networkModeOptions"
              :key="option.value"
              type="button"
              class="network-mode-card"
              :class="{ active: form.network_mode === option.value, nat: option.value === 'nat' }"
              @click="form.network_mode = option.value"
            >
              <div class="network-mode-card-top">
                <span class="network-mode-badge">{{ option.badge }}</span>
                <span class="network-mode-check">{{ form.network_mode === option.value ? '●' : '○' }}</span>
              </div>
              <strong class="network-mode-title">
                {{ option.value === 'nat' ? t('adminCreateProduct.networkNatTitle') : t('adminCreateProduct.networkDedicatedTitle') }}
              </strong>
              <p class="network-mode-desc">
                {{ option.value === 'nat' ? t('adminCreateProduct.networkNatDesc') : t('adminCreateProduct.networkDedicatedDesc') }}
              </p>
            </button>
          </div>
        </section>

        <!-- Inventory / Stock -->
        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminCreateProduct.inventory') }}</h2>
          <p class="section-desc">{{ t('adminCreateProduct.inventoryDesc') }}</p>

          <div class="form-grid">
            <div class="form-group">
              <label>{{ t('adminNodeDetail.totalSlots') }}</label>
              <label class="unlimited-toggle">
                <input type="checkbox" v-model="unlimitedStock" />
                <span>{{ t('adminCreateProduct.unlimitedToggle') }}</span>
              </label>
              <div v-if="!unlimitedStock" class="stepper">
                <button type="button" class="stepper-btn" @click="form.total_slots = Math.max(0, form.total_slots - 1)">−</button>
                <input v-model.number="form.total_slots" type="number" min="0" class="form-input stepper-input" />
                <button type="button" class="stepper-btn" @click="form.total_slots++">+</button>
              </div>
              <div v-else class="unlimited-badge">{{ t('adminCreateProduct.noCapOnInstances') }}</div>
              <span class="form-hint">{{ unlimitedStock ? t('adminCreateProduct.unlimitedHint') : t('adminCreateProduct.limitedHint') }}</span>
            </div>
          </div>
        </section>

        <!-- Pricing -->
        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminCreateProduct.pricing') }}</h2>
          <p class="section-desc">{{ t('adminCreateProduct.pricingDesc') }}</p>

          <div class="form-grid three-col">
            <div class="form-group">
              <label>{{ t('adminCreateProduct.billingCycle') }}</label>
              <select v-model="form.billing_cycle" class="form-select">
                <option v-for="c in billingCycles" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateProduct.price') }}</label>
              <div class="price-input-row">
                <select v-model="form.currency" class="form-select currency-select">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
                <input
                  v-model="form.price_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="9.99"
                  class="form-input price-input"
                />
              </div>
              <span class="form-hint">{{ t('adminCreateProduct.amountPerCycle') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateProduct.preview') }}</label>
              <div class="price-preview">
                <span v-if="priceInCents > 0" class="preview-amount">
                  {{ form.currency }} {{ parseFloat(form.price_amount).toFixed(2) }}
                  <small>{{ billingCycles.find(c => c.value === form.billing_cycle)?.label }}</small>
                </span>
                <span v-else class="preview-placeholder">{{ t('adminCreateProduct.setAPrice') }}</span>
              </div>
            </div>
          </div>
        </section>

        <div v-if="error" class="form-error">{{ error }}</div>

        <div class="form-actions">
          <button type="button" class="action-btn secondary-btn" @click="router.push('/admin/products')">{{ t('common.cancel') }}</button>
          <button
            type="submit"
            class="action-btn primary-btn"
            :disabled="loading || !formValid"
          >
            {{ loading ? t('adminCreateProduct.creatingProduct') : t('adminCreateProduct.createProduct') }}
          </button>
        </div>
      </form>
    </div>
  </AdminLayout>
</template>

<style scoped>
.create-product-page {
  max-width: 800px;
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

.page-header { margin-bottom: 1.5rem; }

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

/* Sections */
.form-section {
  padding: 1.75rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 0.25rem;
}

.section-desc {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0 0 1.25rem;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.form-grid.four-col {
  grid-template-columns: repeat(4, 1fr);
}

.form-grid.three-col {
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 720px) {
  .form-grid.four-col,
  .form-grid.three-col {
    grid-template-columns: 1fr 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-input, .form-select {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}
.form-input::placeholder { color: var(--text-muted); }
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: var(--accent-border);
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
  background: var(--bg-base);
  color: var(--text-primary);
}

.form-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.mono { font-family: monospace; }

/* Unlimited toggle */
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
  width: 50px;
  -moz-appearance: textfield;
}
.stepper-input::-webkit-inner-spin-button,
.stepper-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* Spec summary pills */
.spec-summary {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid var(--divider);
}

.spec-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.85rem;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 20px;
  font-size: 0.8rem;
  color: var(--text-primary);
}
.spec-pill strong {
  color: var(--accent);
}

.network-pill {
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.24);
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

.network-mode-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.55rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.14);
}

.network-mode-card.nat .network-mode-badge {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.14);
}

.network-mode-check {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.network-mode-card.active .network-mode-check {
  color: #f87171;
}

.network-mode-title {
  display: block;
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
}

.network-mode-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Price input */
.price-input-row {
  display: flex;
  gap: 0;
}

.currency-select {
  width: 80px;
  border-radius: 10px 0 0 10px;
  border-right: none;
  flex-shrink: 0;
}

.price-input {
  border-radius: 0 10px 10px 0;
  flex: 1;
}

.price-preview {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 0.85rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
}

.preview-amount {
  font-size: 1.1rem;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.preview-amount small {
  font-size: 0.75rem;
  font-weight: 400;
  -webkit-text-fill-color: var(--text-muted);
  margin-left: 0.35rem;
}

.preview-placeholder {
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* Error */
.form-error {
  margin: 1rem 0;
  padding: 0.75rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  color: var(--danger);
  font-size: 0.85rem;
}

/* Actions */
.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
  margin-bottom: 2rem;
}

@media (max-width: 720px) {
  .network-mode-grid {
    grid-template-columns: 1fr;
  }
}
</style>
