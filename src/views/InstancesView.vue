<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SkeletonLoader from '../components/SkeletonLoader.vue'
import { listInstances, formatDate } from '../api/billing.js'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
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

const filterTabs = computed(() => [
  { key: 'all', label: t('instances.all') },
  { key: 'running', label: t('instances.running') },
  { key: 'stopped', label: t('instances.stopped') },
  { key: 'pending', label: t('instances.pending') },
  { key: 'suspended', label: t('instances.suspended') },
  { key: 'terminated', label: t('instances.terminated') }
])

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
          <h1 class="page-title">{{ t('instances.title') }}</h1>
          <p class="page-subtitle">{{ t('instances.subtitle') }}</p>
        </div>
        <router-link to="/instances/new" class="action-btn primary-btn small-btn">
          {{ t('instances.newInstance') }}
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="searchQuery" type="text" :placeholder="t('instances.searchPlaceholder')" class="search-input" />
        </div>
      </div>

      <!-- Loading — Skeleton Cards -->
      <SkeletonLoader v-if="loading" variant="cards" :rows="4" />

      <!-- Error — toast handles the message, just show empty state -->
      <div v-else-if="error" class="empty-state glass-card">
        <p>{{ t('instances.noMatch') }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredInstances.length === 0" class="empty-state glass-card">
        <p>{{ t('instances.noMatch') }}</p>
        <router-link v-if="instances.length === 0" to="/instances/new" class="action-btn primary-btn small-btn">
          {{ t('instances.deployFirst') }}
        </router-link>
      </div>

      <!-- Instance List -->
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
            <span class="created-date">{{ t('instances.createdOn', { date: formatDate(inst.created_at) }) }}</span>
            <span v-if="inst.started_at" class="running-since">{{ t('instances.runningSince', { date: formatDate(inst.started_at) }) }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.instances-page { max-width: 1100px; margin: 0 auto; }

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.page-title {
  margin: 0; font-size: 1.75rem; font-weight: 700;
  color: var(--text-primary);
}

.page-subtitle { margin: 0.25rem 0 0; color: var(--text-muted); font-size: 0.9rem; }

/* Filters */
.filters {
  padding: 1rem 1.25rem; margin-bottom: 1.5rem;
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 1rem;
}

.filter-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; }

.filter-tab {
  padding: 0.4rem 0.8rem; border: 1px solid transparent; border-radius: 10px;
  background: none; color: var(--text-muted); font-size: 0.82rem;
  cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.35rem;
}

.filter-tab:hover { background: var(--sidebar-hover-bg); color: var(--text-primary); }

.filter-tab.active {
  background: var(--accent-bg); color: var(--accent);
  border-color: var(--accent-border);
}

.count-badge {
  font-size: 0.68rem; background: var(--bg-code); padding: 0.1rem 0.4rem;
  border-radius: 999px; font-weight: 600;
}

.filter-tab.active .count-badge { background: var(--accent-bg-hover); }

.search-box {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--bg-input); border: 1px solid var(--border-default);
  border-radius: 10px; padding: 0.4rem 0.75rem;
}

.search-input {
  background: none; border: none; outline: none;
  color: var(--text-primary); font-size: 0.85rem; width: 200px;
}

.search-input::placeholder { color: var(--text-muted); }

/* Instance cards */
.instance-list { display: flex; flex-direction: column; gap: 0.75rem; }

.instance-card {
  padding: 1.25rem; cursor: pointer; transition: all 0.25s;
  position: relative; overflow: hidden;
}

.instance-card:hover {
  transform: translateY(-1px);
  background: var(--bg-card-hover);
  box-shadow: var(--glass-shadow);
}

.instance-card-top {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 0.75rem;
}

.instance-id-col { display: flex; flex-direction: column; gap: 0.15rem; }

.instance-hostname {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 1rem; font-weight: 600; color: var(--text-primary);
}

.instance-hash {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem; color: var(--accent);
}

.instance-card-body { margin-bottom: 0.75rem; }

.instance-specs { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem; }

.spec-tag {
  font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 6px;
  background: var(--bg-code); border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.plan-tag {
  background: var(--accent-bg); border-color: var(--accent-border);
  color: var(--accent); font-weight: 600;
}

.instance-ip { display: flex; gap: 0.4rem; flex-wrap: wrap; }

.ip-tag {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 4px;
  background: var(--success-bg); border: 1px solid var(--success-border);
  color: var(--success);
}

.ip-tag.ipv6 {
  color: var(--info); background: var(--info-bg); border-color: var(--info-border);
}

.instance-card-bottom { display: flex; justify-content: space-between; align-items: center; }
.created-date { font-size: 0.78rem; color: var(--text-muted); }
.running-since { font-size: 0.78rem; color: var(--success); }

/* States */
.loading-state, .empty-state, .error-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem 1.5rem; color: var(--text-muted);
}

.spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--border-default);
  border-top-color: var(--spinner-color);
  border-radius: 50%; animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
