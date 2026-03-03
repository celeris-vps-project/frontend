<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { listInstances, formatDate } from '../api/billing.js'

const router = useRouter()
const instances = ref([])
const loading = ref(true)
const error = ref('')
const filterStatus = ref('all')
const searchQuery = ref('')

onMounted(fetchInstances)

async function fetchInstances() {
  loading.value = true
  error.value = ''
  try {
    instances.value = await listInstances()
  } catch (err) {
    error.value = err.message
    instances.value = []
  } finally {
    loading.value = false
  }
}

const filteredInstances = computed(() => {
  let results = instances.value
  if (filterStatus.value !== 'all') {
    results = results.filter(i => i.status === filterStatus.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    results = results.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.hostname.toLowerCase().includes(q) ||
      i.plan.toLowerCase().includes(q) ||
      (i.ipv4 && i.ipv4.includes(q))
    )
  }
  return results
})

const statusCounts = computed(() => {
  const counts = { all: instances.value.length, pending: 0, running: 0, stopped: 0, suspended: 0, terminated: 0 }
  instances.value.forEach(i => {
    if (counts[i.status] !== undefined) counts[i.status]++
  })
  return counts
})

const filterTabs = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'stopped', label: 'Stopped' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'terminated', label: 'Terminated' }
]

function specLabel(inst) {
  const mem = inst.memory_mb >= 1024 ? `${inst.memory_mb / 1024}GB` : `${inst.memory_mb}MB`
  return `${inst.cpu} vCPU / ${mem} RAM / ${inst.disk_gb}GB SSD`
}

function goToInstance(id) {
  router.push(`/instances/${id}`)
}
</script>

<template>
  <AppLayout>
    <div class="instances-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">Instances</h1>
          <p class="page-subtitle">Manage your VPS instances</p>
        </div>
        <router-link to="/instances/new" class="action-btn primary-btn">
          <span>✦</span> New Instance
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
            placeholder="Search hostname, IP, plan..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Instance List -->
      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading instances...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn" @click="fetchInstances">Retry</button>
      </div>

      <div v-else-if="filteredInstances.length === 0" class="empty-state glass-card">
        <div class="empty-icon">◈</div>
        <p>No instances match your filters.</p>
        <router-link v-if="instances.length === 0" to="/instances/new" class="action-btn primary-btn">
          Deploy Your First Instance
        </router-link>
      </div>

      <div v-else class="instance-list">
        <div
          v-for="inst in filteredInstances"
          :key="inst.id"
          class="instance-card glass-card"
          @click="goToInstance(inst.id)"
        >
          <div class="instance-card-top">
            <div class="instance-id-col">
              <span class="instance-hostname">{{ inst.hostname }}</span>
              <span class="instance-hash">#{{ inst.id.slice(0, 8) }}</span>
            </div>
            <StatusBadge :status="inst.status" />
          </div>

          <div class="instance-card-body">
            <div class="instance-specs">
              <span class="spec-tag plan-tag">{{ inst.plan }}</span>
              <span class="spec-tag">{{ specLabel(inst) }}</span>
              <span class="spec-tag">{{ inst.os }}</span>
            </div>
            <div v-if="inst.ipv4 || inst.ipv6" class="instance-ip">
              <span v-if="inst.ipv4" class="ip-tag">{{ inst.ipv4 }}</span>
              <span v-if="inst.ipv6" class="ip-tag ipv6">{{ inst.ipv6 }}</span>
            </div>
          </div>

          <div class="instance-card-bottom">
            <span class="created-date">Created {{ formatDate(inst.created_at) }}</span>
            <span v-if="inst.started_at" class="running-since">Running since {{ formatDate(inst.started_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.instances-page {
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
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-tabs {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-tab {
  padding: 0.45rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.825rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.filter-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
}

.filter-tab.active {
  background: rgba(99, 102, 241, 0.15);
  color: #a78bfa;
  border-color: rgba(99, 102, 241, 0.2);
}

.count-badge {
  font-size: 0.7rem;
  background: rgba(255, 255, 255, 0.08);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-weight: 600;
}

.filter-tab.active .count-badge {
  background: rgba(99, 102, 241, 0.25);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
}

.search-icon {
  color: rgba(255, 255, 255, 0.35);
  font-size: 1.1rem;
}

.search-input {
  background: none;
  border: none;
  outline: none;
  color: #fff;
  font-size: 0.875rem;
  width: 220px;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

/* Instance cards */
.instance-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.instance-card {
  padding: 1.25rem;
  cursor: pointer;
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
}

.instance-card:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.08);
}

.instance-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.instance-id-col {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.instance-hostname {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.instance-hash {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  color: rgba(167, 139, 250, 0.7);
}

.instance-card-body {
  margin-bottom: 0.75rem;
}

.instance-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.spec-tag {
  font-size: 0.72rem;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}

.plan-tag {
  background: rgba(99, 102, 241, 0.12);
  border-color: rgba(99, 102, 241, 0.2);
  color: #a78bfa;
  font-weight: 600;
}

.instance-ip {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ip-tag {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.15);
  color: rgba(74, 222, 128, 0.8);
}

.ip-tag.ipv6 {
  color: rgba(96, 165, 250, 0.8);
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.15);
}

.instance-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.created-date {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

.running-since {
  font-size: 0.8rem;
  color: rgba(74, 222, 128, 0.7);
}

/* Loading / Error / Empty */
.loading-state,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  color: rgba(255, 255, 255, 0.5);
}

.empty-icon {
  font-size: 2.5rem;
  color: rgba(255, 255, 255, 0.15);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #a78bfa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
