<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import { createHostNode } from '../../api/admin'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const form = ref({
  code: '',
  location: '',
  name: '',
  secret: ''
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const node = await createHostNode(form.value)
    router.push(`/admin/nodes/${node.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  form.value.secret = result
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

      <section class="form-card glass-card">
        <form @submit.prevent="handleSubmit">
          <div class="form-grid">
            <div class="form-group">
              <label>Node Code</label>
              <input v-model="form.code" type="text" placeholder="e.g. DE-fra-01" required class="form-input" />
              <span class="form-hint">Unique identifier for the node</span>
            </div>

            <div class="form-group">
              <label>Location</label>
              <input v-model="form.location" type="text" placeholder="e.g. DE-fra" required class="form-input" />
              <span class="form-hint">Geographic location code</span>
            </div>

            <div class="form-group full-width">
              <label>Name</label>
              <input v-model="form.name" type="text" placeholder="e.g. Frankfurt #1" required class="form-input" />
            </div>

            <div class="form-group full-width">
              <label>Agent Secret</label>
              <div class="secret-row">
                <input v-model="form.secret" type="text" placeholder="Shared secret for agent auth" required class="form-input" />
                <button type="button" class="action-btn secondary-btn small-btn" @click="generateSecret">Generate</button>
              </div>
              <span class="form-hint">The agent on this host will use this secret to authenticate</span>
            </div>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <div class="form-actions">
            <button
              type="submit"
              class="action-btn primary-btn"
              :disabled="loading || !form.code || !form.location || !form.name || !form.secret"
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

.form-hint {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
}

.secret-row {
  display: flex;
  gap: 0.5rem;
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
</style>
