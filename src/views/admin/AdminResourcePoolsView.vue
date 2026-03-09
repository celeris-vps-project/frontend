<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import { listResourcePools } from '../../api/admin'

const router = useRouter()
const pools = ref([])
const loading = ref(true)
const error = ref('')
const filterStatus = ref('all')
const searchQuery = ref('')

onMounted(fetchPools)

async function fetchPools() {
  loading.value = true
  error.value = ''
  try {
    pools.value = await listResourcePools()
  } catch (err) {
    error.value = err.message
    pools.value = []
  } finally {
    loading.value = false
  }
}

const filteredPools = computed(() => {
  let results = pools.value
  if (filterStatus.value === 'active') {
    results = results.filter(p => p.status === 'active')
  } else if (filterStatus.value === 'inactive') {
    results = results.filter(p => p.status === 'inactive')
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    results = results.filter(p =>
      p.pool_name.toLowerCase().includes(q) ||
      p.pool_id.toLowerCase().includes(q)
    )
  }
  return results
})

const statusCounts = computed(() => {
  const all = pools.value
  return {
    all: all.length,
    active: all.filter(p => p.status === 'active').length,
    inactive: all.filter(p => p.status === 'inactive').length
  }
})

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' }
]

function goToPool(id) {
  router.push(`/admin/resource-pools/${id}`)
}

function usagePercent(used, total) {
  if (!total) return 0
  return Math.round((used / total) * 100)
}

function usageClass(used, total) {
  const pct = usagePercent(used, total)
  if (pct >= 90) return 'usage-critical'
  if (pct >= 70) return 'usage-warning'
  return 'usage-ok'
}
</script>

<template>
  <AdminLayout>
    <div class="pools-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Resource Pools</h1>
          <p class="page-subtitle">Manage node groups for product provisioning</p>
        </div>
        <router-link to="/admin/resource-pools/new" class="action-btn primary-btn small-btn">
          <span>✦</span> New Pool
        </router-link>
      </header>

      <!-- Filters -->
      <div class="filters glass-card">
        <div class="filter-tabs">
          <button
            v-for="tab in filterTabs"
            :key="tab.key"
            class="filter-tab"
            :class="{ active: filterStatus === tab.key }"
            @click="filterStatus = tab.key"
          >
            {{ tab.label }}
            <span class="count-badge">{{ statusCounts[tab.key] }}</span>
          </button>
        </div>
        <div class="search-box">
          <span class="search-icon">⌕</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or ID..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading resource pools...</span>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchPools">Retry</button>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredPools.length === 0" class="empty-state glass-card">
        <div class="empty-icon">⬡</div>
        <p>No resource pools match your filters.</p>
        <router-link v-if="pools.length === 0" to="/admin/resource-pools/new" class="action-btn primary-btn small-btn">
          Create First Pool
        </router-link>
      </div>

      <!-- Pool Cards -->
      <div v-else class="pool-list">
        <div
          v-for="pool in filteredPools"
          :key="pool.pool_id"
          class="pool-card glass-card"
          @click="goToPool(pool.pool_id)"
        >
          <div class="pool-card-top">
            <div class="pool-name-col">
              <span class="pool-name">{{ pool.pool_name }}</span>
              <span class="pool-id mono">{{ pool.pool_id.substring(0, 8) }}…</span>
            </div>
            <span class="status-badge" :class="pool.status">
              {{ pool.status === 'active' ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <div class="pool-card-body">
            <div class="pool-stats">
              <div class="stat-item">
                <span class="stat-label">Nodes</span>
                <span class="stat-value">
                  <span class="stat-highlight">{{ pool.enabled_nodes }}</span>
                  / {{ pool.total_nodes }}
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Capacity</span>
                <span class="stat-value">
                  <span class="stat-highlight">{{ pool.available_slots }}</span>
                  / {{ pool.total_slots }} slots
                </span>
              </div>
            </div>
            <div class="usage-bar-container">
              <div class="usage-bar-track">
                <div
                  class="usage-bar-fill"
                  :class="usageClass(pool.used_slots, pool.total_slots)"
                  :style="{ width: `${usagePercent(pool.used_slots, pool.total_slots)}%` }"
                ></div>
              </div>
              <span class="usage-pct">{{ usagePercent(pool.used_slots, pool.total_slots) }}% used</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.pools-page {
  max-width: 1100px;
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

/* Filters */
.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-tabs { display: flex; gap: 0.25rem; }

.filter-tab {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 0.85rem; border-radius: 8px;
  font-size: 0.825rem; font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  background: none; border: 1px solid transparent;
  cursor: pointer; transition: all 0.2s;
}
.filter-tab:hover { color: rgba(255, 255, 255, 0.8); background: rgba(255, 255, 255, 0.04); }
.filter-tab.active { color: #f87171; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); }

.count-badge {
  background: rgba(255, 255, 255, 0.08);
  padding: 0.1rem 0.45rem; border-radius: 6px; font-size: 0.7rem;
}

.search-box {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px; padding: 0.4rem 0.75rem;
}
.search-icon { color: rgba(255, 255, 255, 0.3); font-size: 0.9rem; }
.search-input {
  background: none; border: none; outline: none;
  color: #fff; font-size: 0.85rem; width: 200px;
}
.search-input::placeholder { color: rgba(255, 255, 255, 0.25); }

/* States */
.loading-state, .error-state, .empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem; color: rgba(255, 255, 255, 0.5);
}
.empty-icon { font-size: 2.5rem; opacity: 0.3; }

.spinner {
  width: 24px; height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Pool Cards */
.pool-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1rem;
}

.pool-card {
  padding: 1.25rem; cursor: pointer; transition: all 0.2s;
}
.pool-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.pool-card-top {
  display: flex; align-items: center;
  justify-content: space-between; margin-bottom: 1rem;
}

.pool-name-col { display: flex; flex-direction: column; gap: 0.15rem; }
.pool-name { font-weight: 700; color: #fff; font-size: 1.05rem; }
.pool-id { font-size: 0.72rem; color: rgba(255, 255, 255, 0.3); }

.status-badge {
  display: inline-flex; padding: 0.2rem 0.6rem; border-radius: 6px;
  font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
}
.status-badge.active {
  background: rgba(34, 197, 94, 0.12); color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.status-badge.inactive {
  background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pool-stats {
  display: flex; gap: 1.5rem; margin-bottom: 0.75rem;
}
.stat-item { display: flex; flex-direction: column; gap: 0.1rem; }
.stat-label { font-size: 0.7rem; color: rgba(255, 255, 255, 0.4); text-transform: uppercase; font-weight: 600; }
.stat-value { font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); }
.stat-highlight { font-weight: 700; color: #fff; }

.usage-bar-container { display: flex; align-items: center; gap: 0.75rem; }
.usage-bar-track {
  flex: 1; height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px; overflow: hidden;
}
.usage-bar-fill {
  height: 100%; border-radius: 3px; transition: width 0.3s ease;
}
.usage-ok { background: linear-gradient(90deg, #22c55e, #4ade80); }
.usage-warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.usage-critical { background: linear-gradient(90deg, #ef4444, #f87171); }

.usage-pct { font-size: 0.72rem; color: rgba(255, 255, 255, 0.4); white-space: nowrap; }

.mono { font-family: monospace; }
</style>
