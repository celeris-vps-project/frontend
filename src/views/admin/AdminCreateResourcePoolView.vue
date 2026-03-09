<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import { createResourcePool, listAllRegions } from '../../api/admin'

const router = useRouter()
const form = ref({ name: '', region_id: '' })
const regions = ref([])
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    regions.value = await listAllRegions()
  } catch (err) {
    console.error('Failed to load regions:', err)
  }
})

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    const pool = await createResourcePool(form.value)
    router.push(`/admin/resource-pools/${pool.id}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AdminLayout>
    <div class="create-pool-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Create Resource Pool</h1>
          <p class="page-subtitle">Add a new node group for product provisioning</p>
        </div>
        <router-link to="/admin/resource-pools" class="action-btn secondary-btn small-btn">← Back</router-link>
      </header>

      <form class="pool-form glass-card" @submit.prevent="handleSubmit">
        <div v-if="error" class="form-error">{{ error }}</div>

        <div class="form-group">
          <label class="form-label">Pool Name</label>
          <input
            v-model="form.name"
            type="text"
            class="form-input"
            placeholder="e.g. Frankfurt Primary"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">Region</label>
          <select v-model="form.region_id" class="form-input" required>
            <option value="" disabled>Select a region</option>
            <option v-for="r in regions" :key="r.id" :value="r.id">
              {{ r.name }} ({{ r.code }})
            </option>
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="action-btn primary-btn" :disabled="loading">
            {{ loading ? 'Creating…' : '✦ Create Pool' }}
          </button>
        </div>
      </form>
    </div>
  </AdminLayout>
</template>

<style scoped>
.create-pool-page {
  max-width: 640px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
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

.pool-form { padding: 2rem; }

.form-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
}

.form-group { margin-bottom: 1.5rem; }

.form-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.7rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.form-input:focus { border-color: rgba(248, 113, 113, 0.4); }
.form-input::placeholder { color: rgba(255, 255, 255, 0.25); }

.form-input option {
  background: #1a1a2e;
  color: #fff;
}

.form-actions { display: flex; justify-content: flex-end; margin-top: 2rem; }
</style>
