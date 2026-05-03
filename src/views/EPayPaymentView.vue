<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import { getOrder, formatMoney } from '../api/billing.js'
import { getPaymentProviders, initiatePayment } from '../api/payment.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const orderID = route.params.id
const order = ref(null)
const provider = ref(null)
const loading = ref(true)
const paying = ref(false)
const error = ref('')
const selectedType = ref('')

const payTypes = [
  { value: 'alipay', labelKey: 'epayPayment.channels.alipay', mark: '支' },
  { value: 'wxpay', labelKey: 'epayPayment.channels.wxpay', mark: '微' },
  { value: 'creditcard', labelKey: 'epayPayment.channels.creditcard', mark: '卡' },
  { value: 'crypto', labelKey: 'epayPayment.channels.crypto', mark: '链' },
  { value: 'paynow', labelKey: 'epayPayment.channels.paynow', mark: 'Pay' },
]

const couponCode = computed(() => String(route.query.coupon_code || '').trim())

onMounted(async () => {
  try {
    const [orderData, providers] = await Promise.all([
      getOrder(orderID),
      getPaymentProviders()
    ])
    order.value = orderData

    const providerID = String(route.query.provider_id || '')
    provider.value = providers.find((item) => item.type === 'epay' && item.id === providerID)
      || providers.find((item) => item.type === 'epay')

    if (!provider.value) {
      error.value = t('epayPayment.noProvider')
    }
  } catch (err) {
    error.value = err.message || t('epayPayment.loadFailed')
  } finally {
    loading.value = false
  }
})

async function startPayment() {
  if (!provider.value || !selectedType.value || paying.value) return
  paying.value = true
  error.value = ''
  try {
    const result = await initiatePayment(orderID, null, provider.value.id, couponCode.value, selectedType.value)
    if (result.status === 'success' || result.payable_amount === 0) {
      router.push(`/orders/${orderID}/payments/status?result=success`)
      return
    }
    if (result.payment_url && result.payment_url.startsWith('http')) {
      window.location.href = result.payment_url
      return
    }
    router.push(`/orders/${orderID}/payments/status`)
  } catch (err) {
    error.value = err.message || t('epayPayment.startFailed')
  } finally {
    paying.value = false
  }
}

function backToCheckout() {
  router.push(`/orders/${orderID}/checkout`)
}
</script>

<template>
  <AppLayout>
    <div class="epay-page">
      <button class="back-btn" @click="backToCheckout">{{ t('epayPayment.backToCheckout') }}</button>

      <section class="payment-shell glass-card">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <span>{{ t('epayPayment.loading') }}</span>
        </div>

        <template v-else>
          <header class="payment-header">
            <div>
              <h1>{{ t('epayPayment.title') }}</h1>
              <p>{{ provider?.name || t('epayPayment.providerName') }}</p>
            </div>
            <div v-if="order" class="amount-box">
              <span>{{ t('epayPayment.amount') }}</span>
              <strong>{{ formatMoney(order.price_amount, order.currency) }}</strong>
            </div>
          </header>

          <div v-if="error" class="error-box">{{ error }}</div>

          <div v-if="provider" class="channel-grid">
            <button
              v-for="item in payTypes"
              :key="item.value"
              type="button"
              class="channel-card"
              :class="{ selected: selectedType === item.value }"
              @click="selectedType = item.value"
            >
              <span class="channel-mark">{{ item.mark }}</span>
              <span class="channel-label">{{ t(item.labelKey) }}</span>
            </button>
          </div>

          <button
            v-if="provider"
            class="action-btn primary-btn pay-btn"
            :disabled="!selectedType || paying"
            @click="startPayment"
          >
            {{ paying ? t('epayPayment.starting') : t('epayPayment.continueToPay') }}
          </button>
        </template>
      </section>
    </div>
  </AppLayout>
</template>

<style scoped>
.epay-page {
  max-width: 820px;
  margin: 0 auto;
}

.back-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1rem;
}

.back-btn:hover {
  color: var(--accent);
}

.payment-shell {
  padding: 1.5rem;
}

.loading-state {
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--text-muted);
}

.payment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.payment-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.45rem;
}

.payment-header p {
  margin: 0.35rem 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.amount-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
  flex-shrink: 0;
}

.amount-box span {
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.amount-box strong {
  color: var(--text-primary);
  font-size: 1.5rem;
}

.error-box {
  margin-bottom: 1rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  color: var(--danger);
  background: var(--danger-bg);
}

.channel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.channel-card {
  min-height: 78px;
  border: 1.5px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem;
  text-align: left;
  transition: all 0.2s;
}

.channel-card:hover {
  border-color: var(--text-muted);
  background: var(--bg-input);
}

.channel-card.selected {
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: 0 0 0 1px var(--accent-border);
}

.channel-mark {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: var(--accent);
  flex-shrink: 0;
}

.channel-label {
  font-size: 0.95rem;
  font-weight: 700;
}

.pay-btn {
  width: 100%;
  min-height: 46px;
  font-size: 0.95rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .payment-header {
    flex-direction: column;
  }

  .amount-box {
    align-items: flex-start;
  }

  .channel-grid {
    grid-template-columns: 1fr;
  }
}
</style>
