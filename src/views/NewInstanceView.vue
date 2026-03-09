<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import {
  listProducts,
  listGroups,
  createOrder
} from '../api/billing.js'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const step = ref(1) // 1: pick group, 2: pick specs, 3: configure & deploy

const form = reactive({
  hostname: '',
  os: 'ubuntu-22.04',
  currency: 'usd'
})

// Backend data
const products = ref([])
const productsLoading = ref(true)
const productsError = ref('')

const groups = ref([])
const groupsLoading = ref(true)
const groupsError = ref('')

const selectedGroup = ref(null)
const selectedProduct = ref(null)

onMounted(async () => {
  // Load groups and products in parallel
  const [groupsResult, productsResult] = await Promise.allSettled([
    listGroups(),
    listProducts()
  ])

  if (groupsResult.status === 'fulfilled') {
    groups.value = groupsResult.value
  } else {
    groupsError.value = groupsResult.reason?.message || 'Failed to load groups'
    groups.value = []
  }
  groupsLoading.value = false

  if (productsResult.status === 'fulfilled') {
    products.value = productsResult.value
  } else {
    productsError.value = productsResult.reason?.message || 'Failed to load products'
    products.value = []
  }
  productsLoading.value = false
})

// ── Computed: build a lookup map from groups by id ──

const groupByID = computed(() => {
  const map = {}
  for (const g of groups.value) {
    map[g.id] = g
  }
  return map
})

// ── Computed: group products by group_id ──

const groupEntries = computed(() => {
  const map = {}
  for (const p of products.value) {
    const gid = p.group_id || 'ungrouped'
    if (!map[gid]) {
      map[gid] = { groupID: gid, products: [], minPrice: Infinity, minCurrency: '', minCycle: '' }
    }
    map[gid].products.push(p)
    if (p.price_amount < map[gid].minPrice) {
      map[gid].minPrice = p.price_amount
      map[gid].minCurrency = p.currency
      map[gid].minCycle = p.billing_cycle
    }
  }
  // Sort by group sort_order (from the groups API), then name
  return Object.values(map).sort((a, b) => {
    const ga = groupByID.value[a.groupID]
    const gb = groupByID.value[b.groupID]
    const orderA = ga ? ga.sort_order : 999
    const orderB = gb ? gb.sort_order : 999
    return orderA - orderB
  })
})

const groupProducts = computed(() => {
  if (!selectedGroup.value) return []
  const entry = groupEntries.value.find(g => g.groupID === selectedGroup.value)
  return entry ? entry.products : []
})

// ── Group display helper ──

function groupDisplay(groupID) {
  const group = groupByID.value[groupID]
  if (group) {
    return { name: group.name, description: group.description }
  }
  return { name: groupID, description: '' }
}

// ── Selection handlers ──

function selectGroup(groupID) {
  selectedGroup.value = groupID
  selectedProduct.value = null
  step.value = 2
}

function selectSpec(product) {
  selectedProduct.value = product
  step.value = 3
}

function goBackToGroups() {
  selectedGroup.value = null
  selectedProduct.value = null
  step.value = 1
}

function goBackToSpecs() {
  selectedProduct.value = null
  step.value = 2
}

// ── Static data ──

const osList = [
  { value: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS' },
  { value: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS' },
  { value: 'debian-12', label: 'Debian 12' },
  { value: 'centos-9', label: 'CentOS Stream 9' },
  { value: 'rocky-9', label: 'Rocky Linux 9' },
  { value: 'windows-2022', label: 'Windows Server 2022' }
]

const currencies = [
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'gbp', label: 'GBP — British Pound' },
  { value: 'jpy', label: 'JPY — Japanese Yen' },
  { value: 'twd', label: 'TWD — New Taiwan Dollar' }
]

// ── Formatting helpers ──

function formatMemory(mb) {
  return mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`
}

function specLabel(product) {
  return `${product.cpu} vCPU / ${formatMemory(product.memory_mb)} RAM / ${product.disk_gb} GB SSD`
}

function formatPrice(cents, currency) {
  const sym = { USD: '$', EUR: '€', GBP: '£' }
  const prefix = sym[currency?.toUpperCase()] || currency + ' '
  return `${prefix}${(cents / 100).toFixed(2)}`
}

function formatCycleShort(cycle) {
  const map = { monthly: '/mo', quarterly: '/qtr', annually: '/yr' }
  return map[cycle] || `/${cycle}`
}

// ── Submit ──

const canSubmit = computed(() => {
  return form.hostname && selectedProduct.value && form.os && form.currency
})

async function handleSubmit() {
  if (!canSubmit.value) return
  error.value = ''
  loading.value = true
  const prevStep = step.value
  step.value = 4 // deploying overlay
  try {
    const product = selectedProduct.value

    const order = await createOrder({
      productID: product.id,
      currency: form.currency,
      priceAmount: product.price_amount,
      hostname: form.hostname,
      plan: product.slug,
      region: product.location,
      os: form.os,
      cpu: product.cpu,
      memoryMB: product.memory_mb,
      diskGB: product.disk_gb
    })

    // Redirect to checkout/payment page instead of purchasing directly
    router.push(`/orders/${order.id}/checkout`)
  } catch (err) {
    error.value = err.message
    step.value = prevStep
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="create-page">
      <header class="page-header">
        <h1 class="page-title">New Instance</h1>
        <p class="page-subtitle">Deploy a new VPS instance</p>
      </header>

      <!-- Loading -->
      <div v-if="productsLoading || groupsLoading" class="glass-card products-loading">
        <div class="spinner"></div>
        <span>Loading available plans...</span>
      </div>

      <!-- Error -->
      <div v-else-if="productsError || groupsError" class="glass-card products-error">
        <p>{{ productsError || groupsError }}</p>
        <button class="action-btn secondary-btn small-btn" @click="productsLoading = true; groupsLoading = true; Promise.allSettled([listGroups(), listProducts()]).then(([g, p]) => { if (g.status === 'fulfilled') { groups = g.value; groupsError = '' } else { groupsError = g.reason?.message } if (p.status === 'fulfilled') { products = p.value; productsError = '' } else { productsError = p.reason?.message } }).finally(() => { productsLoading = false; groupsLoading = false })">Retry</button>
      </div>

      <!-- No products -->
      <div v-else-if="products.length === 0" class="glass-card products-empty">
        <span class="empty-icon">◇</span>
        <p>No plans are currently available. Check back later.</p>
      </div>

      <!-- Main flow -->
      <template v-else>

        <!-- ─── Step 1: Choose Group ─── -->
        <section class="section glass-card" :class="{ dimmed: step > 1 && step < 4 }">
          <div class="section-head">
            <span class="step-num" :class="{ done: step > 1 }">{{ step > 1 ? '✓' : '1' }}</span>
            <h2>Choose a Category</h2>
            <button v-if="step > 1" class="change-btn" @click="goBackToGroups">Change</button>
          </div>

          <!-- Selected group pill (collapsed) -->
          <div v-if="step > 1 && selectedGroup" class="chosen-pill">
            <span class="chosen-label">{{ groupDisplay(selectedGroup).name }}</span>
            <span v-if="groupDisplay(selectedGroup).description" class="chosen-code">{{ groupDisplay(selectedGroup).description }}</span>
          </div>

          <!-- Group cards -->
          <div v-if="step === 1" class="location-grid">
            <div
              v-for="entry in groupEntries"
              :key="entry.groupID"
              class="location-card"
              @click="selectGroup(entry.groupID)"
            >
              <div class="loc-info">
                <div class="loc-city">{{ groupDisplay(entry.groupID).name }}</div>
                <div class="loc-country">{{ groupDisplay(entry.groupID).description }}</div>
              </div>
              <div class="loc-meta">
                <span class="loc-plans">{{ entry.products.length }} {{ entry.products.length === 1 ? 'plan' : 'plans' }}</span>
                <span class="loc-from">from {{ formatPrice(entry.minPrice, entry.minCurrency) }}{{ formatCycleShort(entry.minCycle) }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ─── Step 2: Choose Specs ─── -->
        <section v-if="step >= 2" class="section glass-card" :class="{ dimmed: step > 2 && step < 4 }">
          <div class="section-head">
            <span class="step-num" :class="{ done: step > 2 }">{{ step > 2 ? '✓' : '2' }}</span>
            <h2>Select a Plan</h2>
            <button v-if="step > 2" class="change-btn" @click="goBackToSpecs">Change</button>
          </div>

          <!-- Selected plan pill (collapsed) -->
          <div v-if="step > 2 && selectedProduct" class="chosen-pill">
            <span class="chosen-label">{{ selectedProduct.name }}</span>
            <span class="chosen-code">{{ specLabel(selectedProduct) }}</span>
            <span class="chosen-price">{{ formatPrice(selectedProduct.price_amount, selectedProduct.currency) }}{{ formatCycleShort(selectedProduct.billing_cycle) }}</span>
          </div>

          <!-- Spec cards -->
          <div v-if="step === 2" class="plan-grid">
            <div
              v-for="product in groupProducts"
              :key="product.id"
              class="plan-card"
              :class="{ selected: selectedProduct?.id === product.id }"
              @click="selectSpec(product)"
            >
              <div class="plan-name">{{ product.name }}</div>
              <div class="plan-specs-detail">
                <div class="plan-spec-row">
                  <span class="plan-spec-icon">⚡</span>
                  <span>{{ product.cpu }} vCPU</span>
                </div>
                <div class="plan-spec-row">
                  <span class="plan-spec-icon">◈</span>
                  <span>{{ formatMemory(product.memory_mb) }} RAM</span>
                </div>
                <div class="plan-spec-row">
                  <span class="plan-spec-icon">▣</span>
                  <span>{{ product.disk_gb }} GB NVMe</span>
                </div>
                <div class="plan-spec-row">
                  <span class="plan-spec-icon">↕</span>
                  <span>{{ product.bandwidth_gb ? product.bandwidth_gb + ' GB' : 'Unlimited' }} BW</span>
                </div>
              </div>
              <div class="plan-price">{{ formatPrice(product.price_amount, product.currency) }}<span class="per-mo">{{ formatCycleShort(product.billing_cycle) }}</span></div>
            </div>
          </div>
        </section>

        <!-- ─── Step 3: Configure & Deploy ─── -->
        <section v-if="step >= 3 && step < 4" class="section glass-card">
          <div class="section-head">
            <span class="step-num">3</span>
            <h2>Configure & Deploy</h2>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <form class="config-form" @submit.prevent="handleSubmit">
            <div class="form-row">
              <div class="form-group">
                <label>Hostname</label>
                <input v-model="form.hostname" type="text" placeholder="e.g. web-prod-01" required />
              </div>
              <div class="form-group">
                <label>Operating System</label>
                <select v-model="form.os" required>
                  <option v-for="os in osList" :key="os.value" :value="os.value">{{ os.label }}</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Currency</label>
                <select v-model="form.currency" required>
                  <option v-for="c in currencies" :key="c.value" :value="c.value">{{ c.label }}</option>
                </select>
              </div>
              <div class="form-group"></div>
            </div>

            <!-- Summary -->
            <div v-if="selectedProduct" class="summary-card">
              <h3>Instance Summary</h3>
              <div class="summary-grid">
                <div class="summary-row">
                  <span class="summary-label">Category</span>
                  <span class="summary-value">{{ groupDisplay(selectedGroup).name }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Plan</span>
                  <span class="summary-value">{{ selectedProduct.name }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Specs</span>
                  <span class="summary-value">{{ specLabel(selectedProduct) }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Hostname</span>
                  <span class="summary-value mono">{{ form.hostname || '—' }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">OS</span>
                  <span class="summary-value">{{ osList.find(o => o.value === form.os)?.label || form.os }}</span>
                </div>
                <div class="summary-row total-row">
                  <span class="summary-label">{{ selectedProduct.billing_cycle === 'monthly' ? 'Monthly' : selectedProduct.billing_cycle === 'quarterly' ? 'Quarterly' : 'Annually' }}</span>
                  <span class="summary-value price">{{ formatPrice(selectedProduct.price_amount, selectedProduct.currency) }}{{ formatCycleShort(selectedProduct.billing_cycle) }}</span>
                </div>
              </div>
            </div>

            <button class="action-btn primary-btn submit-btn" type="submit" :disabled="!canSubmit || loading">
              {{ loading ? 'Creating Order...' : 'Proceed to Payment' }}
            </button>
          </form>
        </section>

      </template>

      <!-- Step 4: Deploying overlay -->
      <div v-if="step === 4 && loading" class="deploying-overlay glass-card">
        <div class="spinner"></div>
        <p>Creating your order...</p>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.create-page {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
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

/* ─── Sections ─── */
.section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  transition: opacity 0.3s;
}

.section.dimmed {
  opacity: 0.45;
  pointer-events: none;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #a78bfa;
  font-size: 0.8rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-num.done {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.35);
  color: #4ade80;
  font-size: 0.7rem;
}

.section-head h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  flex: 1;
}

.change-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
  transition: all 0.2s;
}

.change-btn:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

/* ─── Chosen pill (collapsed selection) ─── */
.chosen-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.85rem;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  font-size: 0.85rem;
}

.chosen-flag {
  font-size: 1.1rem;
}

.chosen-label {
  font-weight: 600;
  color: #fff;
}

.chosen-code {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.78rem;
}

.chosen-price {
  margin-left: auto;
  font-weight: 700;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-size: 0.9rem;
}

/* ─── Location grid ─── */
.location-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.location-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1.1rem 1.25rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s;
}

.location-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.loc-flag {
  font-size: 1.75rem;
  flex-shrink: 0;
}

.loc-info {
  flex: 1;
  min-width: 0;
}

.loc-city {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.loc-country {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.1rem;
}

.loc-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  flex-shrink: 0;
}

.loc-plans {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
}

.loc-from {
  font-size: 0.78rem;
  font-weight: 600;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ─── Plan grid ─── */
.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.plan-card {
  padding: 1.25rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.plan-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.plan-card.selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
}

.plan-name {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.plan-specs-detail {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.plan-spec-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.6);
}

.plan-spec-icon {
  width: 16px;
  text-align: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.plan-price {
  font-size: 1.35rem;
  font-weight: 800;
  background: linear-gradient(135deg, #f87171, #fb923c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-top: auto;
}

.per-mo {
  font-size: 0.75rem;
  font-weight: 400;
  -webkit-text-fill-color: rgba(255, 255, 255, 0.4);
}

/* ─── Loading / Error / Empty states ─── */
.products-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.9rem;
}

.products-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem;
  color: #fca5a5;
  font-size: 0.9rem;
}

.products-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem;
  color: rgba(255, 255, 255, 0.45);
}

.empty-icon {
  font-size: 2rem;
  opacity: 0.3;
}

.node-resolving {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

/* ─── Form ─── */
.form-error {
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  .location-grid {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-group input,
.form-group select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  color: #fff;
  font-size: 0.875rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.form-group input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.form-group select option {
  background: #1a1a2e;
  color: #fff;
}

/* ─── Summary ─── */
.summary-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1.25rem;
}

.summary-card h3 {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.summary-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.35rem 0;
}

.summary-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
}

.summary-value {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
}

.summary-value.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.total-row {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 0.6rem;
  margin-top: 0.25rem;
}

.summary-value.price {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
}

.submit-btn {
  margin-top: 0.5rem;
  align-self: flex-start;
}

/* ─── Deploying overlay ─── */
.deploying-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.6);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
