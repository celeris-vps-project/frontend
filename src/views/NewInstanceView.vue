<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import {
  listLocations,
  listNodes,
  createOrder,
  purchaseInstance
} from '../api/billing.js'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const step = ref(1) // 1: pick plan, 2: configure, 3: deploying

const form = reactive({
  hostname: '',
  plan: '',
  os: 'ubuntu-22.04',
  currency: 'usd',
  locationCode: '',
  nodeID: ''
})

// Backend data
const locations = ref([])
const nodes = ref([])
const locationsLoading = ref(true)
const nodesLoading = ref(false)

onMounted(async () => {
  try {
    locations.value = await listLocations()
  } catch {
    locations.value = []
  } finally {
    locationsLoading.value = false
  }
})

async function onLocationChange() {
  form.nodeID = ''
  nodes.value = []
  if (!form.locationCode) return
  nodesLoading.value = true
  try {
    const all = await listNodes(form.locationCode)
    // Only show nodes that have capacity
    nodes.value = all.filter(n => n.enabled && n.available_slots > 0)
    // Auto-select first available node
    if (nodes.value.length > 0) {
      form.nodeID = nodes.value[0].id
    }
  } catch {
    nodes.value = []
  } finally {
    nodesLoading.value = false
  }
}

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

// VPS presets
const presets = [
  { name: 'VPS Starter', plan: 'vps-starter', cpu: 1, memoryMB: 1024, diskGB: 25, price: 500 },
  { name: 'VPS Basic', plan: 'vps-basic', cpu: 1, memoryMB: 2048, diskGB: 50, price: 1000 },
  { name: 'VPS Standard', plan: 'vps-standard', cpu: 2, memoryMB: 4096, diskGB: 80, price: 2000 },
  { name: 'VPS Pro', plan: 'vps-pro', cpu: 4, memoryMB: 8192, diskGB: 160, price: 4000 },
  { name: 'VPS Enterprise', plan: 'vps-enterprise', cpu: 8, memoryMB: 16384, diskGB: 320, price: 8000 },
  { name: 'VPS Ultimate', plan: 'vps-ultimate', cpu: 16, memoryMB: 32768, diskGB: 640, price: 16000 }
]

const selectedPreset = ref(null)

function selectPreset(preset) {
  selectedPreset.value = preset
  form.plan = preset.plan
}

function specLabel(preset) {
  const mem = preset.memoryMB >= 1024 ? `${preset.memoryMB / 1024}GB` : `${preset.memoryMB}MB`
  return `${preset.cpu} vCPU / ${mem} RAM / ${preset.diskGB}GB SSD`
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

const canSubmit = computed(() => {
  return form.hostname && selectedPreset.value && form.locationCode && form.nodeID && form.os && form.currency
})

async function handleSubmit() {
  if (!canSubmit.value) return
  error.value = ''
  loading.value = true
  step.value = 3
  try {
    const preset = selectedPreset.value

    // Step 1: create order
    const order = await createOrder({
      currency: form.currency,
      priceAmount: preset.price,
      hostname: form.hostname,
      plan: preset.plan,
      region: form.locationCode,
      os: form.os,
      cpu: preset.cpu,
      memoryMB: preset.memoryMB,
      diskGB: preset.diskGB
    })

    // Step 2: purchase instance with the order
    const instance = await purchaseInstance({
      orderID: order.id,
      nodeID: form.nodeID,
      hostname: form.hostname,
      plan: preset.plan,
      os: form.os,
      cpu: preset.cpu,
      memoryMB: preset.memoryMB,
      diskGB: preset.diskGB
    })

    router.push(`/instances/${instance.id}`)
  } catch (err) {
    error.value = err.message
    step.value = 2
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

      <!-- Step 1: Choose Plan -->
      <section class="section glass-card" :class="{ dimmed: step > 1 && step < 3 }">
        <div class="section-head">
          <span class="step-num">1</span>
          <h2>Choose a Plan</h2>
        </div>
        <div class="plan-grid">
          <div
            v-for="preset in presets"
            :key="preset.plan"
            class="plan-card"
            :class="{ selected: selectedPreset?.plan === preset.plan }"
            @click="selectPreset(preset); step = 2"
          >
            <div class="plan-name">{{ preset.name }}</div>
            <div class="plan-specs">{{ specLabel(preset) }}</div>
            <div class="plan-price">{{ formatPrice(preset.price) }}<span class="per-mo">/mo</span></div>
          </div>
        </div>
      </section>

      <!-- Step 2: Configure -->
      <section v-if="step >= 2" class="section glass-card">
        <div class="section-head">
          <span class="step-num">2</span>
          <h2>Configure Your Instance</h2>
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
              <label>Location</label>
              <div v-if="locationsLoading" class="field-loading">Loading locations...</div>
              <select v-else v-model="form.locationCode" required @change="onLocationChange">
                <option value="" disabled>Select a location</option>
                <option
                  v-for="loc in locations"
                  :key="loc.location"
                  :value="loc.location"
                  :disabled="loc.available_slots === 0"
                >
                  {{ loc.location }} — {{ loc.available_slots }} slots available
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Node</label>
              <div v-if="nodesLoading" class="field-loading">Loading nodes...</div>
              <select v-else v-model="form.nodeID" required :disabled="nodes.length === 0">
                <option value="" disabled>{{ form.locationCode ? 'Select a node' : 'Pick location first' }}</option>
                <option v-for="node in nodes" :key="node.id" :value="node.id">
                  {{ node.name }} ({{ node.code }}) — {{ node.available_slots }} free
                </option>
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
          <div v-if="selectedPreset" class="summary-card">
            <h3>Instance Summary</h3>
            <div class="summary-grid">
              <div class="summary-row">
                <span class="summary-label">Plan</span>
                <span class="summary-value">{{ selectedPreset.name }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Specs</span>
                <span class="summary-value">{{ specLabel(selectedPreset) }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Hostname</span>
                <span class="summary-value mono">{{ form.hostname || '—' }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">OS</span>
                <span class="summary-value">{{ osList.find(o => o.value === form.os)?.label || form.os }}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Location</span>
                <span class="summary-value">{{ form.locationCode || '—' }}</span>
              </div>
              <div class="summary-row total-row">
                <span class="summary-label">Monthly</span>
                <span class="summary-value price">{{ formatPrice(selectedPreset.price) }}/mo</span>
              </div>
            </div>
          </div>

          <button class="action-btn primary-btn submit-btn" type="submit" :disabled="!canSubmit || loading">
            {{ loading ? 'Deploying...' : 'Deploy Instance' }}
          </button>
        </form>
      </section>

      <!-- Step 3: Deploying overlay -->
      <div v-if="step === 3 && loading" class="deploying-overlay glass-card">
        <div class="spinner"></div>
        <p>Provisioning your instance...</p>
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

/* Sections */
.section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  transition: opacity 0.3s;
}

.section.dimmed {
  opacity: 0.4;
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
}

.section-head h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
}

/* Plan grid */
.plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
}

.plan-card {
  padding: 1.25rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.plan-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.plan-card.selected {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.15);
}

.plan-name {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 0.35rem;
}

.plan-specs {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.5rem;
}

.plan-price {
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
}

.per-mo {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 400;
}

/* Form */
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

.field-loading {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  padding: 0.6rem 0;
}

/* Summary */
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

/* Deploying */
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

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
