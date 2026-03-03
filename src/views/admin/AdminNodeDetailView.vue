<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminLayout from '../../components/AdminLayout.vue'
import NodeStatusBadge from '../../components/NodeStatusBadge.vue'
import {
  getHostNode,
  listIPs,
  addIP,
  enqueueTask,
  formatPercent,
  formatDateTime
} from '../../api/admin'

const route = useRoute()
const router = useRouter()
const nodeID = route.params.id

const node = ref(null)
const ips = ref([])
const loading = ref(true)
const error = ref('')

// -- Add IP form --
const showAddIP = ref(false)
const ipForm = ref({ address: '', version: 4 })
const ipLoading = ref(false)
const ipError = ref('')

// -- Enqueue Task form --
const showTaskForm = ref(false)
const taskForm = ref({
  type: 'provision',
  spec: {
    instance_id: '',
    hostname: '',
    os: 'ubuntu-22.04',
    cpu: 1,
    memory_mb: 1024,
    disk_gb: 25,
    virt_type: 'kvm'
  }
})
const taskLoading = ref(false)
const taskError = ref('')
const taskSuccess = ref('')

onMounted(fetchAll)

async function fetchAll() {
  loading.value = true
  error.value = ''
  try {
    const [n, ipList] = await Promise.all([
      getHostNode(nodeID),
      listIPs(nodeID)
    ])
    node.value = n
    ips.value = ipList
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleAddIP() {
  ipError.value = ''
  ipLoading.value = true
  try {
    const newIP = await addIP(nodeID, {
      address: ipForm.value.address,
      version: ipForm.value.version
    })
    ips.value.push(newIP)
    ipForm.value = { address: '', version: 4 }
    showAddIP.value = false
  } catch (err) {
    ipError.value = err.message
  } finally {
    ipLoading.value = false
  }
}

async function handleEnqueueTask() {
  taskError.value = ''
  taskSuccess.value = ''
  taskLoading.value = true
  try {
    const task = await enqueueTask(nodeID, {
      type: taskForm.value.type,
      spec: {
        ...taskForm.value.spec,
        cpu: Number(taskForm.value.spec.cpu),
        memory_mb: Number(taskForm.value.spec.memory_mb),
        disk_gb: Number(taskForm.value.spec.disk_gb)
      }
    })
    taskSuccess.value = `Task ${task.id} queued successfully`
    taskForm.value.spec.instance_id = ''
    taskForm.value.spec.hostname = ''
  } catch (err) {
    taskError.value = err.message
  } finally {
    taskLoading.value = false
  }
}

const taskTypes = ['provision', 'deprovision', 'start', 'stop', 'reboot', 'suspend', 'unsuspend']
</script>

<template>
  <AdminLayout>
    <div class="node-detail">
      <!-- Back button -->
      <button class="back-btn" @click="router.push('/admin/nodes')">← Back to Nodes</button>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>Loading node details...</span>
      </div>

      <div v-else-if="error" class="error-state glass-card">
        <p>{{ error }}</p>
        <button class="action-btn secondary-btn small-btn" @click="fetchAll">Retry</button>
      </div>

      <template v-else-if="node">
        <!-- Node Header -->
        <header class="node-header">
          <div>
            <h1 class="page-title">{{ node.code }}</h1>
            <p class="page-subtitle">{{ node.name }} — {{ node.location }}</p>
          </div>
          <NodeStatusBadge :status="node.status" />
        </header>

        <!-- Info Cards -->
        <div class="info-grid">
          <div class="info-card glass-card">
            <span class="info-label">IP Address</span>
            <span class="info-value mono">{{ node.ip || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Agent Version</span>
            <span class="info-value">{{ node.agent_ver || '—' }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">VMs Running</span>
            <span class="info-value">{{ node.vm_count }}</span>
          </div>
          <div class="info-card glass-card">
            <span class="info-label">Last Seen</span>
            <span class="info-value">{{ node.last_seen_at ? formatDateTime(node.last_seen_at) : '—' }}</span>
          </div>
        </div>

        <!-- Usage -->
        <section class="usage-section glass-card">
          <h2>Resource Usage</h2>
          <div class="usage-bars">
            <div class="usage-row">
              <span class="usage-label">CPU</span>
              <div class="bar-track"><div class="bar-fill cpu-fill" :style="{ width: `${node.cpu_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(node.cpu_usage) }}</span>
            </div>
            <div class="usage-row">
              <span class="usage-label">Memory</span>
              <div class="bar-track"><div class="bar-fill mem-fill" :style="{ width: `${node.mem_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(node.mem_usage) }}</span>
            </div>
            <div class="usage-row">
              <span class="usage-label">Disk</span>
              <div class="bar-track"><div class="bar-fill disk-fill" :style="{ width: `${node.disk_usage}%` }"></div></div>
              <span class="usage-val">{{ formatPercent(node.disk_usage) }}</span>
            </div>
          </div>
        </section>

        <!-- IP Pool -->
        <section class="ips-section glass-card">
          <div class="section-header">
            <h2>IP Pool ({{ ips.length }})</h2>
            <button class="action-btn accent-btn small-btn" @click="showAddIP = !showAddIP">
              {{ showAddIP ? 'Cancel' : '+ Add IP' }}
            </button>
          </div>

          <!-- Add IP Form -->
          <div v-if="showAddIP" class="inline-form">
            <div class="form-row">
              <input v-model="ipForm.address" type="text" placeholder="e.g. 185.1.2.3" class="form-input" />
              <select v-model.number="ipForm.version" class="form-select">
                <option :value="4">IPv4</option>
                <option :value="6">IPv6</option>
              </select>
              <button class="action-btn primary-btn small-btn" :disabled="ipLoading || !ipForm.address" @click="handleAddIP">
                {{ ipLoading ? 'Adding...' : 'Add' }}
              </button>
            </div>
            <p v-if="ipError" class="form-error">{{ ipError }}</p>
          </div>

          <div v-if="ips.length === 0" class="empty-inline">No IPs assigned to this node.</div>

          <table v-else class="ips-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Version</th>
                <th>Status</th>
                <th>Instance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ip in ips" :key="ip.id">
                <td class="mono">{{ ip.address }}</td>
                <td>IPv{{ ip.version }}</td>
                <td>
                  <span class="ip-status" :class="ip.available ? 'avail' : 'assigned'">
                    {{ ip.available ? 'Available' : 'Assigned' }}
                  </span>
                </td>
                <td class="mono">{{ ip.instance_id || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Enqueue Task -->
        <section class="task-section glass-card">
          <div class="section-header">
            <h2>Enqueue Task</h2>
            <button class="action-btn accent-btn small-btn" @click="showTaskForm = !showTaskForm">
              {{ showTaskForm ? 'Cancel' : '+ New Task' }}
            </button>
          </div>

          <div v-if="showTaskForm" class="task-form">
            <div class="form-grid">
              <div class="form-group">
                <label>Task Type</label>
                <select v-model="taskForm.type" class="form-select">
                  <option v-for="t in taskTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Instance ID</label>
                <input v-model="taskForm.spec.instance_id" type="text" class="form-input" placeholder="inst-xxx" />
              </div>
              <div class="form-group">
                <label>Hostname</label>
                <input v-model="taskForm.spec.hostname" type="text" class="form-input" placeholder="web-01" />
              </div>
              <div class="form-group">
                <label>OS Image</label>
                <input v-model="taskForm.spec.os" type="text" class="form-input" />
              </div>
              <div class="form-group">
                <label>CPU</label>
                <input v-model.number="taskForm.spec.cpu" type="number" min="1" class="form-input" />
              </div>
              <div class="form-group">
                <label>Memory (MB)</label>
                <input v-model.number="taskForm.spec.memory_mb" type="number" min="256" class="form-input" />
              </div>
              <div class="form-group">
                <label>Disk (GB)</label>
                <input v-model.number="taskForm.spec.disk_gb" type="number" min="5" class="form-input" />
              </div>
              <div class="form-group">
                <label>Virt Type</label>
                <select v-model="taskForm.spec.virt_type" class="form-select">
                  <option value="kvm">KVM</option>
                  <option value="lxc">LXC</option>
                </select>
              </div>
            </div>

            <div class="form-actions">
              <button
                class="action-btn primary-btn small-btn"
                :disabled="taskLoading"
                @click="handleEnqueueTask"
              >
                {{ taskLoading ? 'Sending...' : 'Enqueue Task' }}
              </button>
            </div>
            <p v-if="taskError" class="form-error">{{ taskError }}</p>
            <p v-if="taskSuccess" class="form-success">{{ taskSuccess }}</p>
          </div>
        </section>
      </template>
    </div>
  </AdminLayout>
</template>

<style scoped>
.node-detail {
  max-width: 1100px;
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

.node-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  font-family: monospace;
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

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.info-card {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.info-value {
  font-size: 1.1rem;
  color: #fff;
  font-weight: 600;
}
.mono { font-family: monospace; }

/* Usage */
.usage-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}
.usage-section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #fff; }

.usage-bars { display: flex; flex-direction: column; gap: 0.75rem; }

.usage-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.usage-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  width: 60px;
}

.bar-track {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.cpu-fill { background: linear-gradient(90deg, #6366f1, #818cf8); }
.mem-fill { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
.disk-fill { background: linear-gradient(90deg, #f59e0b, #fbbf24); }

.usage-val {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  width: 55px;
  text-align: right;
  font-family: monospace;
}

/* Sections */
.ips-section, .task-section {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.section-header h2 { margin: 0; font-size: 1.1rem; color: #fff; }

/* Inline form */
.inline-form {
  margin-bottom: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.form-input, .form-select {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  color: #fff;
}
.form-input:focus, .form-select:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
}
.form-select {
  appearance: none;
  cursor: pointer;
}

.form-error {
  margin: 0.5rem 0 0;
  color: #f87171;
  font-size: 0.8rem;
}
.form-success {
  margin: 0.5rem 0 0;
  color: #4ade80;
  font-size: 0.8rem;
}

.empty-inline {
  padding: 1.5rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.9rem;
}

/* IP Table */
.ips-table {
  width: 100%;
  border-collapse: collapse;
}
.ips-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.ips-table td {
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.ip-status {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}
.avail {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}
.assigned {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}

/* Task form */
.task-form {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-group label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

/* Loading / Error */
.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: rgba(255, 255, 255, 0.5);
}

.spinner {
  width: 24px; height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top: 2px solid #f87171;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
