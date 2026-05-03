<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import { getGeneralSettings, getProviderTypes, createPaymentProvider } from '../../api/admin'

const { t } = useI18n()
const router = useRouter()

const providerTypes = ref([])
const loading = ref(true)
const creating = ref(false)
const error = ref('')
const success = ref(false)
const publicBaseUrl = ref('')

// Form state
const selectedType = ref('')
const name = ref('')
const sortOrder = ref(0)
const configValues = ref({})

// Crypto USDT wallet networks
const cryptoNetworks = ['arbitrum', 'solana', 'trc20', 'bsc', 'polygon']

onMounted(async () => {
  try {
    const [types, general] = await Promise.all([
      getProviderTypes(),
      getGeneralSettings().catch(() => ({}))
    ])
    providerTypes.value = types
    publicBaseUrl.value = general.public_base_url || ''
    if (providerTypes.value.length > 0) {
      selectedType.value = providerTypes.value[0].type
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

// When type changes, reset config and set default name
watch(selectedType, (newType) => {
  configValues.value = {}
  const typeInfo = providerTypes.value.find(t => t.type === newType)
  if (typeInfo) {
    name.value = typeInfo.display_name
    // Initialize wallets for crypto
    if (newType === 'crypto_usdt') {
      configValues.value.wallets = {}
      cryptoNetworks.forEach(n => { configValues.value.wallets[n] = '' })
    }
    // Pre-fill default pay_type for EPay (alipay is the most common channel)
    if (newType === 'epay') {
      configValues.value.pay_type = 'alipay'
      configValues.value.timestamp_header = 'timestamp'
      configValues.value.signature_header = 'signature'
    }
  }
})

const selectedTypeInfo = computed(() => {
  return providerTypes.value.find(t => t.type === selectedType.value)
})

const epayWebhookPreview = computed(() => {
  if (selectedType.value !== 'epay') return ''
  const baseURL = publicBaseUrl.value.trim().replace(/\/+$/, '')
  if (!baseURL) return ''
  return `${baseURL}/api/v1/payments/webhook/epay/{providerId}`
})

const typeIcons = {
  crypto_usdt: '₮',
  stripe: '💳',
  paypal: '🅿',
  alipay: '🔵',
  wechat_pay: '💚',
  epay: '易',
}

const typeColors = {
  crypto_usdt: '#26a17b',
  stripe: '#635bff',
  paypal: '#003087',
  alipay: '#1677ff',
  wechat_pay: '#07c160',
  epay: '#e63946',
}

function buildConfig() {
  const info = selectedTypeInfo.value
  if (!info) return {}

  const config = {}
  for (const field of info.fields) {
    if (field.key === 'notify_url') continue
    if (field.type === 'wallets') {
      // Filter out empty wallet addresses
      const wallets = {}
      if (configValues.value.wallets) {
        for (const [net, addr] of Object.entries(configValues.value.wallets)) {
          if (addr && addr.trim()) wallets[net] = addr.trim()
        }
      }
      if (Object.keys(wallets).length > 0) config[field.key] = wallets
    } else if (field.type === 'bool') {
      config[field.key] = !!configValues.value[field.key]
    } else if (field.type === 'number') {
      const v = configValues.value[field.key]
      if (v !== undefined && v !== '') config[field.key] = Number(v)
    } else {
      const v = configValues.value[field.key]
      if (v && v.trim()) config[field.key] = v.trim()
    }
  }
  return config
}

async function handleCreate() {
  error.value = ''
  if (!name.value.trim()) {
    error.value = t('adminPayment.nameRequired')
    return
  }
  if (selectedType.value === 'epay' && !publicBaseUrl.value.trim()) {
    error.value = t('adminPayment.publicBaseUrlRequired')
    return
  }

  creating.value = true
  try {
    await createPaymentProvider({
      type: selectedType.value,
      name: name.value.trim(),
      sort_order: sortOrder.value,
      config: buildConfig(),
    })
    success.value = true
  } catch (err) {
    error.value = err.message
  } finally {
    creating.value = false
  }
}

function goBack() {
  router.push('/admin/payment-providers')
}
</script>

<template>
  <AdminLayout>
    <div class="create-provider-page">
      <header class="page-header">
        <button class="back-link" @click="goBack">{{ t('adminPayment.backToProviders') }}</button>
        <h1 class="page-title">{{ t('adminPayment.createTitle') }}</h1>
        <p class="page-subtitle">{{ t('adminPayment.createSubtitle') }}</p>
      </header>

      <!-- Loading -->
      <div v-if="loading" class="glass-card loading-state">
        <div class="spinner"></div>
        <span>{{ t('common.loading') }}</span>
      </div>

      <!-- Success -->
      <div v-else-if="success" class="glass-card success-state">
        <div class="success-icon">✓</div>
        <h2>{{ t('adminPayment.providerCreated') }}</h2>
        <p>{{ t('adminPayment.providerCreatedDesc') }}</p>
        <button class="action-btn primary-btn" @click="goBack">
          {{ t('adminPayment.goToProviders') }}
        </button>
      </div>

      <!-- Form -->
      <div v-else class="form-container">
        <!-- Step 1: Select Type -->
        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminPayment.providerType') }}</h2>
          <p class="section-desc">{{ t('adminPayment.providerTypeDesc') }}</p>

          <div class="type-grid">
            <button
              v-for="pt in providerTypes"
              :key="pt.type"
              class="type-card"
              :class="{ selected: selectedType === pt.type }"
              :style="{ '--type-color': typeColors[pt.type] || '#888' }"
              @click="selectedType = pt.type"
            >
              <span class="type-icon">{{ typeIcons[pt.type] || '💰' }}</span>
              <span class="type-name">{{ pt.display_name }}</span>
              <span class="type-code">{{ pt.type }}</span>
              <span class="type-check" v-if="selectedType === pt.type">✓</span>
            </button>
          </div>
        </section>

        <!-- Step 2: Basic Info -->
        <section class="form-section glass-card">
          <h2 class="section-title">{{ t('adminPayment.basicInfo') }}</h2>

          <div class="form-group">
            <label class="form-label">{{ t('adminPayment.providerName') }}</label>
            <input
              v-model="name"
              type="text"
              class="form-input"
              :placeholder="t('adminPayment.providerNamePlaceholder')"
            />
            <span class="form-hint">{{ t('adminPayment.providerNameHint') }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('adminPayment.sortOrder') }}</label>
            <input
              v-model.number="sortOrder"
              type="number"
              class="form-input small-input"
              min="0"
            />
            <span class="form-hint">{{ t('adminPayment.sortOrderHint') }}</span>
          </div>
        </section>

        <!-- Step 3: Dynamic Config -->
        <section v-if="selectedTypeInfo" class="form-section glass-card">
          <h2 class="section-title">{{ t('adminPayment.configuration') }}</h2>
          <p class="section-desc">{{ t('adminPayment.configurationDesc') }}</p>

          <div v-if="selectedType === 'epay'" class="form-group">
            <label class="form-label">{{ t('adminPayment.webhookUrl') }}</label>
            <div class="auto-generated-hint" :class="{ warning: !epayWebhookPreview }">
              <span class="auto-tag">{{ t('adminPayment.autoGenerated') }}</span>
              <code v-if="epayWebhookPreview" class="webhook-url-inline">{{ epayWebhookPreview }}</code>
              <span v-else>{{ t('adminPayment.publicBaseUrlRequired') }}</span>
            </div>
            <span class="form-hint">{{ t('adminPayment.publicBaseUrlHint') }}</span>
          </div>

          <div v-for="field in selectedTypeInfo.fields" :key="field.key" class="form-group">
            <!-- Special: Wallets (crypto_usdt) -->
            <template v-if="field.type === 'wallets'">
              <label class="form-label">{{ field.label }}</label>
              <span class="form-hint">{{ field.help_text }}</span>
              <div class="wallets-grid">
                <div
                  v-for="net in cryptoNetworks"
                  :key="net"
                  class="wallet-row"
                >
                  <span class="wallet-network">{{ net }}</span>
                  <input
                    v-model="configValues.wallets[net]"
                    type="text"
                    class="form-input wallet-input"
                    :placeholder="`${net} wallet address`"
                  />
                </div>
              </div>
            </template>

            <!-- Bool toggle -->
            <template v-else-if="field.type === 'bool'">
              <div class="toggle-row">
                <label class="form-label">{{ field.label }}</label>
                <button
                  class="toggle-btn"
                  :class="{ active: configValues[field.key] }"
                  @click="configValues[field.key] = !configValues[field.key]"
                >
                  {{ configValues[field.key] ? 'ON' : 'OFF' }}
                </button>
              </div>
              <span class="form-hint">{{ field.help_text }}</span>
            </template>

            <!-- String / Number input -->
            <template v-else>
              <label class="form-label">
                {{ field.label }}
                <span v-if="field.required" class="required-mark">*</span>
              </label>
              <input
                v-model="configValues[field.key]"
                :type="field.type === 'number' ? 'number' : 'text'"
                class="form-input"
                :placeholder="field.placeholder || ''"
              />
              <span class="form-hint">{{ field.help_text }}</span>
            </template>
          </div>
        </section>

        <!-- Error -->
        <div v-if="error" class="error-banner">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button class="action-btn secondary-btn" @click="goBack">
            {{ t('common.cancel') }}
          </button>
          <button
            class="action-btn primary-btn"
            :disabled="creating || !name.trim()"
            @click="handleCreate"
          >
            {{ creating ? t('adminPayment.creating') : t('adminPayment.createProvider') }}
          </button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.create-provider-page {
  max-width: 720px;
  margin: 0 auto;
}

.page-header { margin-bottom: 1.5rem; }

.back-link {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0;
  margin-bottom: 0.5rem;
  display: block;
}
.back-link:hover { text-decoration: underline; }

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

/* Form sections */
.form-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-section {
  padding: 1.5rem;
}

.section-title {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.section-desc {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  color: var(--text-muted);
}

/* Type selector */
.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.65rem;
}

.type-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  padding: 1rem 0.75rem;
  border-radius: 12px;
  background: var(--bg-input);
  border: 2px solid var(--border-default);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  color: inherit;
  font: inherit;
}

.type-card:hover {
  border-color: var(--text-muted);
  transform: translateY(-2px);
}

.type-card.selected {
  border-color: var(--type-color);
  box-shadow: 0 0 0 1px var(--type-color), 0 4px 12px rgba(0, 0, 0, 0.15);
}

.type-icon { font-size: 1.5rem; }
.type-name { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }
.type-code { font-size: 0.65rem; color: var(--text-muted); font-family: monospace; }

.type-check {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--type-color);
  color: #fff;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

/* Form fields */
.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.35rem;
}

.required-mark { color: var(--danger); }

.form-input {
  width: 100%;
  padding: 0.55rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus { border-color: var(--accent); }

.small-input { max-width: 120px; }

.form-hint {
  display: block;
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

/* Wallets grid */
.wallets-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.wallet-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wallet-network {
  width: 80px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  flex-shrink: 0;
}

.wallet-input {
  flex: 1;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 0.78rem;
}

/* Toggle */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 20px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success);
}

/* Auto-generated EPay webhook preview */
.auto-generated-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  border-radius: 8px;
  border: 1px dashed var(--border-default);
  background: var(--bg-input);
  color: var(--text-muted);
  font-size: 0.82rem;
}

.auto-generated-hint.warning {
  border-color: var(--warning-border);
  color: var(--warning);
}

.auto-tag {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.webhook-url-inline {
  font-size: 0.72rem;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  color: var(--accent);
  word-break: break-all;
  background: transparent;
}

/* Error */
.error-banner {
  padding: 0.75rem 1rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  color: var(--danger);
  font-size: 0.82rem;
}

/* Actions */
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

/* States */
.loading-state, .success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
}

.success-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--success-bg);
  border: 2px solid var(--success-border);
  color: var(--success);
  font-size: 1.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-state h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.2rem;
}

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
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 0.85rem;
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
.primary-btn:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4); transform: translateY(-1px); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.secondary-btn {
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.glass-card {
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  backdrop-filter: blur(20px);
}
</style>
