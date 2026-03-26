<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import { createInvoice, addLineItem, formatMoney } from '../api/billing.js'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const step = ref(1) // 1 = basic info, 2 = add line items

const form = reactive({
  customerID: '',
  currency: 'usd'
})

const createdInvoice = ref(null)
const lineItems = ref([])
const newItem = ref({ description: '', quantity: 1, unitPrice: 0 })

const currencies = [
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'gbp', label: 'GBP — British Pound' },
  { value: 'jpy', label: 'JPY — Japanese Yen' },
  { value: 'twd', label: 'TWD — New Taiwan Dollar' }
]

// VPS product presets
const presets = [
  { name: 'VPS Starter', desc: 'VPS 1 vCPU / 1GB RAM / 25GB SSD', price: 5.00 },
  { name: 'VPS Basic', desc: 'VPS 1 vCPU / 2GB RAM / 50GB SSD', price: 10.00 },
  { name: 'VPS Standard', desc: 'VPS 2 vCPU / 4GB RAM / 80GB SSD', price: 20.00 },
  { name: 'VPS Pro', desc: 'VPS 4 vCPU / 8GB RAM / 160GB SSD', price: 40.00 },
  { name: 'VPS Enterprise', desc: 'VPS 8 vCPU / 16GB RAM / 320GB SSD', price: 80.00 },
  { name: 'VPS Ultimate', desc: 'VPS 16 vCPU / 32GB RAM / 640GB SSD', price: 160.00 }
]

const lineItemsTotal = computed(() => {
  return lineItems.value.reduce((sum, item) => sum + (item.quantity * item.unitPrice * 100), 0)
})

async function handleCreateDraft() {
  error.value = ''
  loading.value = true
  try {
    createdInvoice.value = await createInvoice(form.customerID, form.currency)
    step.value = 2
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function addPreset(preset) {
  newItem.value.description = preset.desc
  newItem.value.unitPrice = preset.price
  newItem.value.quantity = 1
}

async function handleAddItem() {
  if (!newItem.value.description || newItem.value.quantity < 1) return
  error.value = ''
  loading.value = true
  try {
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    const result = await addLineItem(createdInvoice.value.id, {
      id,
      description: newItem.value.description,
      quantity: newItem.value.quantity,
      unit_price: Math.round(newItem.value.unitPrice * 100)
    })
    createdInvoice.value = result
    lineItems.value.push({ ...newItem.value })
    newItem.value = { description: '', quantity: 1, unitPrice: 0 }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function goToInvoice() {
  router.push(`/invoices/${createdInvoice.value.id}`)
}
</script>

<template>
  <AppLayout>
    <div class="create-page">
      <header class="page-header">
        <h1 class="page-title">{{ t('createInvoice.title') }}</h1>
        <p class="page-subtitle">{{ t('createInvoice.subtitle') }}</p>
      </header>

      <!-- Step indicators -->
      <div class="steps glass-card">
        <div class="step" :class="{ active: step >= 1, done: step > 1 }">
          <div class="step-circle">{{ step > 1 ? '✓' : '1' }}</div>
          <span class="step-label">{{ t('createInvoice.invoiceDetails') }}</span>
        </div>
        <div class="step-line" :class="{ filled: step > 1 }"></div>
        <div class="step" :class="{ active: step >= 2 }">
          <div class="step-circle">2</div>
          <span class="step-label">{{ t('createInvoice.lineItemsStep') }}</span>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="notification notification-error glass-card" @click="error = ''">
        {{ error }}
      </div>

      <!-- Step 1: Basic Info -->
      <div v-if="step === 1" class="step-content glass-card">
        <h2>{{ t('createInvoice.invoiceDetails') }}</h2>
        <form @submit.prevent="handleCreateDraft" class="create-form">
          <div class="form-group">
            <label for="customerId">{{ t('createInvoice.customerId') }}</label>
            <input
              id="customerId"
              v-model="form.customerID"
              type="text"
              :placeholder="t('createInvoice.customerIdPlaceholder')"
              required
            />
          </div>

          <div class="form-group">
            <label for="currency">{{ t('createInvoice.currency') }}</label>
            <select id="currency" v-model="form.currency" class="glass-select">
              <option v-for="c in currencies" :key="c.value" :value="c.value">
                {{ c.label }}
              </option>
            </select>
          </div>

          <button class="action-btn primary-btn" type="submit" :disabled="loading">
            {{ loading ? t('createInvoice.creating') : t('createInvoice.createDraft') }}
          </button>
        </form>
      </div>

      <!-- Step 2: Line Items -->
      <div v-if="step === 2" class="step-content">
        <!-- VPS Presets -->
        <div class="presets-section glass-card">
          <h2>{{ t('createInvoice.vpsPlans') }}</h2>
          <p class="presets-desc">{{ t('createInvoice.vpsPlansDesc') }}</p>
          <div class="presets-grid">
            <button
              v-for="preset in presets"
              :key="preset.name"
              class="preset-card"
              :class="{ selected: newItem.description === preset.desc }"
              @click="addPreset(preset)"
            >
              <span class="preset-name">{{ preset.name }}</span>
              <span class="preset-spec">{{ preset.desc }}</span>
              <span class="preset-price">${{ preset.price.toFixed(2) }}/mo</span>
            </button>
          </div>
        </div>

        <!-- Custom item form -->
        <div class="item-form-section glass-card">
          <h2>{{ t('createInvoice.addLineItem') }}</h2>
          <form @submit.prevent="handleAddItem" class="create-form">
            <div class="form-row">
              <div class="form-group flex-2">
                <label>{{ t('createInvoice.description') }}</label>
                <input
                  v-model="newItem.description"
                  type="text"
                  :placeholder="t('createInvoice.descriptionPlaceholder')"
                  required
                />
              </div>
              <div class="form-group">
                <label>{{ t('createInvoice.quantity') }}</label>
                <input v-model.number="newItem.quantity" type="number" min="1" required />
              </div>
              <div class="form-group">
                <label>{{ t('createInvoice.unitPrice') }}</label>
                <input v-model.number="newItem.unitPrice" type="number" min="0" step="0.01" required />
              </div>
            </div>
            <button class="action-btn accent-btn" type="submit" :disabled="loading">
            {{ loading ? t('createInvoice.addingItem') : t('createInvoice.addToInvoice') }}
            </button>
          </form>
        </div>

        <!-- Added items preview -->
        <div v-if="lineItems.length > 0" class="added-items glass-card">
          <h2>{{ t('createInvoice.addedItems') }}</h2>
          <table class="items-table">
            <thead>
              <tr>
                <th>{{ t('createInvoice.description') }}</th>
                <th class="text-right">{{ t('createInvoice.quantity') }}</th>
                <th class="text-right">{{ t('createInvoice.unitPrice') }}</th>
                <th class="text-right">{{ t('invoiceDetail.total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in lineItems" :key="idx">
                <td>{{ item.description }}</td>
                <td class="text-right">{{ item.quantity }}</td>
                <td class="text-right">${{ item.unitPrice.toFixed(2) }}</td>
                <td class="text-right fw-600">${{ (item.quantity * item.unitPrice).toFixed(2) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" class="text-right">{{ t('invoiceDetail.subtotal') }}</td>
                <td class="text-right fw-700">{{ formatMoney(lineItemsTotal, form.currency) }}</td>
              </tr>
            </tfoot>
          </table>

          <div class="finish-actions">
            <button class="action-btn primary-btn" @click="goToInvoice">
              {{ t('createInvoice.continueToInvoice') }}
            </button>
          </div>
        </div>
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
  margin-bottom: 1.5rem;
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

/* Steps */
.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  gap: 0;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.4;
  transition: opacity 0.3s;
}

.step.active {
  opacity: 1;
}

.step-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-input);
  border: 2px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-primary);
  transition: all 0.3s;
}

.step.active .step-circle {
  background: var(--accent-bg-hover);
  border-color: #6366f1;
  color: var(--accent);
}

.step.done .step-circle {
  background: var(--success-bg);
  border-color: #22c55e;
  color: var(--success);
}

.step-label {
  font-size: 0.85rem;
  color: var(--text-primary);
  font-weight: 500;
}

.step-line {
  width: 80px;
  height: 2px;
  background: var(--bg-input);
  margin: 0 1rem;
  transition: background 0.3s;
}

.step-line.filled {
  background: var(--accent-gradient);
}

/* Notification */
.notification {
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
  cursor: pointer;
}

.notification-error {
  border-left: 3px solid var(--danger);
  color: var(--danger);
}

/* Step content */
.step-content h2 {
  margin: 0 0 1rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
}

.step-content.glass-card {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

/* Form */
.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 140px;
}

.form-group.flex-2 {
  flex: 2;
}

.form-group label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-group input,
.glass-select {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 0.65rem 0.85rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.glass-select:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.glass-select {
  appearance: none;
  cursor: pointer;
}

.glass-select option {
  background: var(--bg-base);
  color: var(--text-primary);
}

/* Presets */
.presets-section {
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.presets-desc {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0 0 1rem;
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
}

.preset-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s;
  color: var(--text-primary);
}

.preset-card:hover {
  background: var(--bg-input);
  border-color: var(--accent-border);
  transform: translateY(-1px);
}

.preset-card.selected {
  background: var(--accent-bg);
  border-color: var(--accent-border);
  box-shadow: var(--card-shadow);
}

.preset-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--accent);
}

.preset-spec {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.preset-price {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 0.25rem;
}

/* Item form */
.item-form-section {
  padding: 1.5rem;
  margin-bottom: 1rem;
}

/* Added items */
.added-items {
  padding: 1.5rem;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.25rem;
}

.items-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--divider);
}

.items-table td {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
}

.items-table tfoot .total-row td {
  color: var(--text-primary);
  font-size: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--divider);
  border-bottom: none;
}

.text-right { text-align: right; }
.fw-600 { font-weight: 600; }
.fw-700 { font-weight: 700; }

.finish-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
