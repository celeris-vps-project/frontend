<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminLayout from '../../components/AdminLayout.vue'
import { createHostNode } from '../../api/admin'

const { t } = useI18n()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const createdToken = ref(null) // holds the bootstrap token after creation
const createdNode = ref(null)  // holds the created node data
const form = ref({
  code: '',
  location: '',
  name: '',
  total_slots: 10,
  nat_entry_host: '',
  nat_bridge: 'vmbr2',
  nat_port_start: 20000,
  nat_port_end: 65535,
  token_ttl_minutes: 1440 // 24 hours
})

const codePlaceholder = computed(() => {
  if (form.value.location) {
    return `e.g. ${form.value.location}-01 (auto)`
  }
  return 'Auto-generated from location'
})

const natPortRangeInvalid = computed(() => {
  const start = Number(form.value.nat_port_start)
  const end = Number(form.value.nat_port_end)
  return !Number.isInteger(start) || !Number.isInteger(end) || start < 1024 || end > 65535 || start >= end
})

const natBridgeInvalid = computed(() => {
  const bridge = String(form.value.nat_bridge || '').trim()
  return !bridge || bridge.length > 15 || /\s/.test(bridge)
})

async function handleSubmit() {
  error.value = ''
  if (natBridgeInvalid.value) {
    error.value = t('adminCreateNode.natBridgeInvalid')
    return
  }
  if (natPortRangeInvalid.value) {
    error.value = t('adminCreateNode.natPortRangeInvalid')
    return
  }
  loading.value = true
  try {
    const { node, bootstrap_token } = await createHostNode({
      ...form.value,
      nat_entry_host: String(form.value.nat_entry_host || '').trim(),
      nat_bridge: String(form.value.nat_bridge || '').trim(),
      token_description: `Bootstrap token for ${form.value.code || form.value.name}`
    })
    if (bootstrap_token) {
      createdNode.value = node
      createdToken.value = bootstrap_token
    } else {
      // Fallback: go to node detail if no token returned
      router.push(`/admin/nodes/${node.id}`)
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function copyToken() {
  if (createdToken.value?.token) {
    navigator.clipboard.writeText(createdToken.value.token)
  }
}

function goToNode() {
  router.push('/admin/nodes')
}
</script>

<template>
  <AdminLayout>
    <div class="create-node-page">
      <button class="back-btn" @click="router.push('/admin/nodes')">{{ t('adminCreateNode.backToNodes') }}</button>

      <header class="page-header">
        <h1 class="page-title">{{ t('adminCreateNode.title') }}</h1>
        <p class="page-subtitle">{{ t('adminCreateNode.subtitle') }}</p>
      </header>

      <!-- ── Token created: show result ── -->
      <section v-if="createdToken" class="form-card glass-card token-result">
        <div class="success-icon">✓</div>
        <h2 class="token-title">{{ t('adminCreateNode.nodeCreated') }}</h2>
        <p class="token-subtitle">{{ t('adminCreateNode.tokenCopyHint') }}</p>

        <div class="token-box">
          <code class="token-value">{{ createdToken.token }}</code>
          <button type="button" class="action-btn secondary-btn small-btn" @click="copyToken">{{ t('common.copy') }}</button>
        </div>

        <div class="token-meta">
          <span>{{ t('adminNodeDetail.expires', { time: new Date(createdToken.expires_at).toLocaleString() }) }}</span>
        </div>

        <div class="token-yaml-hint">
          <p class="hint-label">{{ t('adminNodeDetail.agentYamlExample') }}</p>
          <pre class="yaml-block">bootstrap_token: "{{ createdToken.token }}"</pre>
        </div>

        <div class="form-actions">
          <button type="button" class="action-btn primary-btn" @click="goToNode">{{ t('adminCreateNode.goToNodes') }}</button>
        </div>
      </section>

      <!-- ── Create form ── -->
      <section v-else class="form-card glass-card">
        <form @submit.prevent="handleSubmit">
          <div class="form-grid">
            <div class="form-group">
              <label>{{ t('adminCreateNode.location') }} <span class="required">*</span></label>
              <input v-model="form.location" type="text" :placeholder="t('adminCreateNode.locationPlaceholder')" required class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.locationHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.nodeCode') }}</label>
              <input v-model="form.code" type="text" :placeholder="codePlaceholder" class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.nodeCodeHint') }}</span>
            </div>

            <div class="form-group full-width">
              <label>{{ t('adminCreateNode.name') }}</label>
              <input v-model="form.name" type="text" :placeholder="t('adminCreateNode.namePlaceholder')" class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.nameHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.totalSlots') }}</label>
              <input v-model.number="form.total_slots" type="number" min="0" placeholder="e.g. 10" required class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.totalSlotsHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.natBridge') }}</label>
              <input v-model="form.nat_bridge" type="text" placeholder="vmbr2" required class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.natBridgeHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.natEntryHost') }}</label>
              <input v-model="form.nat_entry_host" type="text" placeholder="203.0.113.10" class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.natEntryHostHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.natPortStart') }}</label>
              <input v-model.number="form.nat_port_start" type="number" min="1024" max="65535" required class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.natPortStartHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.natPortEnd') }}</label>
              <input v-model.number="form.nat_port_end" type="number" min="1024" max="65535" required class="form-input" />
              <span class="form-hint">{{ t('adminCreateNode.natPortEndHint') }}</span>
            </div>

            <div class="form-group">
              <label>{{ t('adminCreateNode.bootstrapTokenTTL') }}</label>
              <select v-model.number="form.token_ttl_minutes" class="form-input">
                <option :value="60">{{ t('adminCreateNode.ttl1h') }}</option>
                <option :value="360">{{ t('adminCreateNode.ttl6h') }}</option>
                <option :value="1440">{{ t('adminCreateNode.ttl24h') }}</option>
                <option :value="4320">{{ t('adminCreateNode.ttl3d') }}</option>
                <option :value="10080">{{ t('adminCreateNode.ttl7d') }}</option>
              </select>
              <span class="form-hint">{{ t('adminCreateNode.tokenTTLHint') }}</span>
            </div>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <div class="form-actions">
            <button
              type="submit"
              class="action-btn primary-btn"
              :disabled="loading || !form.location || natBridgeInvalid || natPortRangeInvalid"
            >
              {{ loading ? t('adminCreateNode.creatingNode') : t('adminCreateNode.createNode') }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.create-node-page {
  max-width: 700px;
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

.form-card { padding: 2rem; }

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.form-group.full-width { grid-column: 1 / -1; }

.form-group label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-input {
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
.form-input:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

select.form-input {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,0.4)' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2rem;
}
select.form-input option {
  background: #1e1e2e;
  color: var(--text-primary);
}

.form-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
}

.required {
  color: var(--danger);
  font-weight: 600;
}

.form-error {
  margin: 1rem 0;
  padding: 0.75rem;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 8px;
  color: var(--danger);
  font-size: 0.85rem;
}

.form-actions {
  margin-top: 1.5rem;
}

/* ── Token result styles ── */

.token-result {
  text-align: center;
}

.success-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  background: var(--success-bg);
  border: 2px solid var(--success-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #22c55e;
}

.token-title {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--text-primary);
}

.token-subtitle {
  margin: 0 0 1.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.5;
}
.token-subtitle code {
  background: var(--bg-input);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.token-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  margin: 0 auto 1rem;
  max-width: 100%;
}

.token-value {
  flex: 1;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  color: #facc15;
  word-break: break-all;
  text-align: left;
}

.token-meta {
  color: var(--text-muted);
  font-size: 0.75rem;
  margin-bottom: 1.25rem;
}

.token-yaml-hint {
  text-align: left;
  margin-bottom: 1.5rem;
}

.hint-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin: 0 0 0.4rem;
}

.yaml-block {
  background: var(--bg-code);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: var(--text-primary);
  overflow-x: auto;
  margin: 0;
}
</style>
