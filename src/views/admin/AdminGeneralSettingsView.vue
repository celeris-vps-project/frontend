<script setup>
import { onMounted, ref } from 'vue'
import AdminLayout from '../../components/AdminLayout.vue'
import { getGeneralSettings, updateGeneralSettings } from '../../api/admin'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const registrationVerificationEnabled = ref(false)
const registrationVerificationRequired = ref(false)
const smtpEnabled = ref(false)
const publicBaseUrl = ref('')

onMounted(loadSettings)

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const data = await getGeneralSettings()
    registrationVerificationEnabled.value = !!data.registration_verification_enabled
    registrationVerificationRequired.value = !!data.registration_verification_required
    smtpEnabled.value = !!data.smtp_enabled
    publicBaseUrl.value = data.public_base_url || ''
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  error.value = ''
  try {
    const data = await updateGeneralSettings({
      registration_verification_enabled: registrationVerificationEnabled.value,
      public_base_url: publicBaseUrl.value.trim()
    })
    registrationVerificationEnabled.value = !!data.registration_verification_enabled
    registrationVerificationRequired.value = !!data.registration_verification_required
    smtpEnabled.value = !!data.smtp_enabled
    publicBaseUrl.value = data.public_base_url || ''
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="settings-page">
      <header class="page-header">
        <h1 class="page-title">通用设置</h1>
        <p class="page-subtitle">控制站点级账号注册和公网回调地址。</p>
      </header>

      <section v-if="loading" class="glass-card state-card">加载中...</section>
      <section v-else class="glass-card form-card">
        <div v-if="error" class="error-banner">{{ error }}</div>

        <div class="setting-block">
          <label class="field-label" for="public-base-url">公网 API Base URL</label>
          <input
            id="public-base-url"
            v-model="publicBaseUrl"
            type="text"
            class="text-input"
            placeholder="https://cloud.voidval.com"
          />
          <p class="field-hint">用于支付网关 Webhook 回调；不要填写后端监听端口，除非该端口能被公网直接访问。</p>
        </div>

        <div class="setting-row">
          <div>
            <h2>注册邮箱验证</h2>
            <p>开启后，注册需要先通过邮箱验证码。SMTP 未启用时不会强制验证。</p>
          </div>
          <button
            class="toggle-btn"
            :class="{ active: registrationVerificationEnabled }"
            @click="registrationVerificationEnabled = !registrationVerificationEnabled"
          >
            {{ registrationVerificationEnabled ? 'ON' : 'OFF' }}
          </button>
        </div>

        <div class="status-strip" :class="registrationVerificationRequired ? 'success' : 'muted'">
          当前生效状态：
          <strong>{{ registrationVerificationRequired ? '注册需要邮箱验证码' : '注册不需要邮箱验证码' }}</strong>
          <span v-if="registrationVerificationEnabled && !smtpEnabled">SMTP 未启用，验证要求暂不生效。</span>
        </div>

        <div class="actions">
          <button class="action-btn secondary-btn" @click="loadSettings">刷新</button>
          <button class="action-btn primary-btn" :disabled="saving" @click="saveSettings">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.settings-page {
  max-width: 760px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 1.8rem;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
}

.form-card,
.state-card {
  padding: 1.5rem;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  margin-top: 1.25rem;
}

.setting-block {
  margin-bottom: 1.25rem;
}

.field-label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.text-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.text-input:focus {
  border-color: var(--accent);
}

.field-hint {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.setting-row h2 {
  margin: 0;
  font-size: 1.05rem;
  color: var(--text-primary);
}

.setting-row p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.toggle-btn {
  min-width: 72px;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-muted);
  font-weight: 700;
  cursor: pointer;
}

.toggle-btn.active {
  background: var(--success-bg);
  color: var(--success);
  border-color: var(--success-border);
}

.status-strip {
  margin-top: 1.25rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  font-size: 0.88rem;
}

.status-strip.success {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.status-strip.muted {
  background: var(--bg-input);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.status-strip span {
  display: block;
  margin-top: 0.25rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.action-btn {
  width: auto;
}

.error-banner {
  margin-bottom: 1rem;
  padding: 0.7rem 1rem;
  border-radius: 10px;
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}
</style>
