<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import { createHostNode } from '../../api/admin'

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
  token_ttl_minutes: 1440 // 24 hours
})

const codePlaceholder = computed(() => {
  if (form.value.location) {
    return `e.g. ${form.value.location}-01 (auto)`
  }
  return 'Auto-generated from location'
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const { node, bootstrap_token } = await createHostNode({
      ...form.value,
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
      <button class="back-btn" @click="router.push('/admin/nodes')">← Back to Nodes</button>

      <header class="page-header">
        <h1 class="page-title">Add Host Node</h1>
        <p class="page-subtitle">Register a new physical server in the infrastructure</p>
      </header>

      <!-- ── Token created: show result ── -->
      <section v-if="createdToken" class="form-card glass-card token-result">
        <div class="success-icon">✓</div>
        <h2 class="token-title">Node Created Successfully</h2>
        <p class="token-subtitle">
          Copy the bootstrap token below and paste it into the agent's <code>agent.yaml</code> as <code>bootstrap_token</code>.
          This token can only be used once and will expire.
        </p>

        <div class="token-box">
          <code class="token-value">{{ createdToken.token }}</code>
          <button type="button" class="action-btn secondary-btn small-btn" @click="copyToken">Copy</button>
        </div>

        <div class="token-meta">
          <span>Expires: {{ new Date(createdToken.expires_at).toLocaleString() }}</span>
        </div>

        <div class="token-yaml-hint">
          <p class="hint-label">agent.yaml example:</p>
          <pre class="yaml-block">bootstrap_token: "{{ createdToken.token }}"</pre>
        </div>

        <div class="form-actions">
          <button type="button" class="action-btn primary-btn" @click="goToNode">Go to Nodes</button>
        </div>
      </section>

      <!-- ── Create form ── -->
      <section v-else class="form-card glass-card">
        <form @submit.prevent="handleSubmit">
          <div class="form-grid">
            <div class="form-group">
              <label>Location <span class="required">*</span></label>
              <input v-model="form.location" type="text" placeholder="e.g. DE-fra" required class="form-input" />
              <span class="form-hint">Geographic location code (required)</span>
            </div>

            <div class="form-group">
              <label>Node Code</label>
              <input v-model="form.code" type="text" :placeholder="codePlaceholder" class="form-input" />
              <span class="form-hint">Optional — auto-generated from location if left empty</span>
            </div>

            <div class="form-group full-width">
              <label>Name</label>
              <input v-model="form.name" type="text" placeholder="e.g. Frankfurt #1 (optional, defaults to node code)" class="form-input" />
              <span class="form-hint">Optional — if left empty, the node code is used as the display name</span>
            </div>

            <div class="form-group">
              <label>Total Slots</label>
              <input v-model.number="form.total_slots" type="number" min="0" placeholder="e.g. 10" required class="form-input" />
              <span class="form-hint">Max number of VMs this node can host</span>
            </div>

            <div class="form-group">
              <label>Bootstrap Token TTL</label>
              <select v-model.number="form.token_ttl_minutes" class="form-input">
                <option :value="60">1 hour</option>
                <option :value="360">6 hours</option>
                <option :value="1440">24 hours</option>
                <option :value="4320">3 days</option>
                <option :value="10080">7 days</option>
              </select>
              <span class="form-hint">How long the bootstrap token remains valid</span>
            </div>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <div class="form-actions">
            <button
              type="submit"
              class="action-btn primary-btn"
              :disabled="loading || !form.location"
            >
              {{ loading ? 'Creating...' : 'Create Node' }}
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
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 1rem;
  transition: color 0.2s;
}
.back-btn:hover { color: #fff; }

.page-header { margin-bottom: 1.5rem; }

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
  color: rgba(255, 255, 255, 0.55);
  font-weight: 500;
}

.form-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font-size: 0.9rem;
  color: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}
.form-input::placeholder { color: rgba(255, 255, 255, 0.25); }
.form-input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
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
  color: #fff;
}

.form-hint {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
}

.required {
  color: #f87171;
  font-weight: 600;
}

.form-error {
  margin: 1rem 0;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #f87171;
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
  background: rgba(34, 197, 94, 0.15);
  border: 2px solid rgba(34, 197, 94, 0.4);
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
  color: #fff;
}

.token-subtitle {
  margin: 0 0 1.5rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
  line-height: 1.5;
}
.token-subtitle code {
  background: rgba(255, 255, 255, 0.08);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.8);
}

.token-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.75rem;
  margin-bottom: 1.25rem;
}

.token-yaml-hint {
  text-align: left;
  margin-bottom: 1.5rem;
}

.hint-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 0 0 0.4rem;
}

.yaml-block {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  overflow-x: auto;
  margin: 0;
}
</style>
