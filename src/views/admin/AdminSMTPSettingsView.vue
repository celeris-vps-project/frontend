<script setup>
import { onMounted, ref } from 'vue'
import AdminLayout from '../../components/AdminLayout.vue'
import { getSMTPSettings, testSMTP, updateSMTPSettings } from '../../api/admin'

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const error = ref('')
const testEmail = ref('')
const form = ref(defaultForm())

function defaultForm() {
  return {
    enabled: false,
    host: '',
    port: 587,
    username: '',
    password: '',
    password_set: false,
    from_email: '',
    from_name: 'Celeris',
    use_tls: false,
    use_starttls: true
  }
}

onMounted(loadSettings)

async function loadSettings() {
  loading.value = true
  error.value = ''
  try {
    const data = await getSMTPSettings()
    form.value = {
      ...defaultForm(),
      ...data,
      password: ''
    }
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
    const data = await updateSMTPSettings({
      enabled: form.value.enabled,
      host: form.value.host,
      port: Number(form.value.port || 587),
      username: form.value.username,
      password: form.value.password,
      from_email: form.value.from_email,
      from_name: form.value.from_name,
      use_tls: form.value.use_tls,
      use_starttls: form.value.use_starttls
    })
    form.value = { ...defaultForm(), ...data, password: '' }
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function sendTest() {
  if (!testEmail.value) {
    error.value = '请输入测试收件邮箱。'
    return
  }
  testing.value = true
  error.value = ''
  try {
    await testSMTP(testEmail.value)
  } catch (err) {
    error.value = err.message
  } finally {
    testing.value = false
  }
}

function setTLSMode(mode) {
  form.value.use_tls = mode === 'tls'
  form.value.use_starttls = mode === 'starttls'
}
</script>

<template>
  <AdminLayout>
    <div class="settings-page">
      <header class="page-header">
        <h1 class="page-title">SMTP 设置</h1>
        <p class="page-subtitle">配置注册验证码和找回密码邮件发送。</p>
      </header>

      <section v-if="loading" class="glass-card state-card">加载中...</section>
      <section v-else class="glass-card form-card">
        <div v-if="error" class="error-banner">{{ error }}</div>

        <div class="top-row">
          <div>
            <h2>邮件发送服务</h2>
            <p>关闭 SMTP 后，注册验证码不会生效，找回密码邮件也不可用。</p>
          </div>
          <button class="toggle-btn" :class="{ active: form.enabled }" @click="form.enabled = !form.enabled">
            {{ form.enabled ? 'ON' : 'OFF' }}
          </button>
        </div>

        <div class="grid">
          <label>
            Host
            <input v-model="form.host" type="text" placeholder="smtp.example.com" />
          </label>
          <label>
            Port
            <input v-model.number="form.port" type="number" min="1" max="65535" />
          </label>
          <label>
            Username
            <input v-model="form.username" type="text" autocomplete="username" />
          </label>
          <label>
            Password
            <input v-model="form.password" type="password" autocomplete="new-password" :placeholder="form.password_set ? '已保存，留空保持不变' : ''" />
          </label>
          <label>
            From Email
            <input v-model="form.from_email" type="email" placeholder="noreply@example.com" />
          </label>
          <label>
            From Name
            <input v-model="form.from_name" type="text" placeholder="Celeris" />
          </label>
        </div>

        <div class="mode-row">
          <span>加密方式</span>
          <button class="chip" :class="{ active: !form.use_tls && !form.use_starttls }" @click="setTLSMode('plain')">Plain</button>
          <button class="chip" :class="{ active: form.use_starttls }" @click="setTLSMode('starttls')">STARTTLS</button>
          <button class="chip" :class="{ active: form.use_tls }" @click="setTLSMode('tls')">TLS</button>
        </div>

        <div class="test-row">
          <input v-model="testEmail" type="email" placeholder="测试收件邮箱" />
          <button class="action-btn secondary-btn" :disabled="testing || !form.enabled" @click="sendTest">
            {{ testing ? '发送中...' : '发送测试邮件' }}
          </button>
        </div>

        <div class="actions">
          <button class="action-btn secondary-btn" @click="loadSettings">刷新</button>
          <button class="action-btn primary-btn" :disabled="saving" @click="saveSettings">
            {{ saving ? '保存中...' : '保存 SMTP' }}
          </button>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.settings-page {
  max-width: 860px;
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

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.top-row h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.05rem;
}

.top-row p {
  margin: 0.35rem 0 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}

input {
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  outline: none;
}

input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.toggle-btn,
.chip {
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-muted);
  font-weight: 700;
  cursor: pointer;
}

.toggle-btn {
  min-width: 72px;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
}

.toggle-btn.active,
.chip.active {
  background: var(--success-bg);
  color: var(--success);
  border-color: var(--success-border);
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.25rem;
  color: var(--text-secondary);
  font-size: 0.86rem;
  font-weight: 600;
}

.chip {
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
}

.test-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  margin-top: 1.25rem;
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

@media (max-width: 720px) {
  .grid,
  .test-row {
    grid-template-columns: 1fr;
  }
}
</style>
