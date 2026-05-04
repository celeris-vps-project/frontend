<script setup>
import { ref, computed, onMounted } from 'vue'
import AdminLayout from '../../components/AdminLayout.vue'
import { listProvisioningRepairs, repairProvisioning, formatDateTime } from '../../api/admin'

const items = ref([])
const loading = ref(true)
const error = ref('')
const processing = ref({})
const resultMessage = ref('')

const processableCount = computed(() => items.value.filter(item => item.can_repair).length)

onMounted(fetchQueue)

async function fetchQueue() {
  loading.value = true
  error.value = ''
  resultMessage.value = ''
  try {
    items.value = await listProvisioningRepairs()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleProcess(item) {
  processing.value[item.order_id] = true
  resultMessage.value = ''
  try {
    const result = await repairProvisioning(item.order_id)
    resultMessage.value = result?.queued
      ? `已下发补开通任务 ${result.task_id}，节点 ${result.node_id}`
      : result?.candidate?.reason || '未进入人工处理队列'
    await fetchQueue()
  } catch (err) {
    error.value = err.message
  } finally {
    processing.value[item.order_id] = false
  }
}

function shortID(id) {
  if (!id) return '-'
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id
}
</script>

<template>
  <AdminLayout>
    <div class="queue-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">人工处理队列</h1>
          <p class="page-subtitle">{{ processableCount }} 条可处理 / {{ items.length }} 条支付成功后卡住的记录</p>
        </div>
        <button class="action-btn secondary-btn small-btn" :disabled="loading" @click="fetchQueue">
          {{ loading ? '加载中' : '刷新队列' }}
        </button>
      </header>

      <p v-if="resultMessage" class="form-success">{{ resultMessage }}</p>
      <p v-if="error" class="form-error">{{ error }}</p>

      <div v-if="loading" class="loading-state glass-card">
        <div class="spinner"></div>
        <span>加载人工处理队列...</span>
      </div>

      <section v-else class="queue-section glass-card">
        <div v-if="items.length === 0" class="empty-state">
          <span>暂无支付成功后卡在 provisioning 的订单。</span>
        </div>

        <table v-else class="queue-table">
          <thead>
            <tr>
              <th>订单</th>
              <th>实例</th>
              <th>套餐</th>
              <th>网络</th>
              <th>资源池余量</th>
              <th>状态</th>
              <th>创建时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.order_id">
              <td class="mono" :title="item.order_id">{{ shortID(item.order_id) }}</td>
              <td>
                <div class="instance-cell">
                  <span class="mono" :title="item.instance_id">{{ shortID(item.instance_id) }}</span>
                  <span>{{ item.hostname }}</span>
                </div>
              </td>
              <td>{{ item.plan }}</td>
              <td>{{ item.network_mode }}</td>
              <td :class="{ danger: item.available_slots <= 0 }">{{ item.available_slots }}</td>
              <td>
                <span class="status-chip" :class="item.can_repair ? 'ok' : 'blocked'">
                  {{ item.can_repair ? '可处理' : '阻塞' }}
                </span>
                <small v-if="item.reason">{{ item.reason }}</small>
              </td>
              <td>{{ formatDateTime(item.created_at) }}</td>
              <td class="actions-cell">
                <button
                  class="action-btn primary-btn small-btn"
                  :disabled="!item.can_repair || processing[item.order_id]"
                  @click="handleProcess(item)"
                >
                  {{ processing[item.order_id] ? '处理中' : '补开通' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.queue-page {
  max-width: 1180px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.queue-section {
  padding: 1.5rem;
}

.queue-table {
  width: 100%;
  border-collapse: collapse;
}

.queue-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  color: var(--text-muted);
  border-bottom: 1px solid var(--divider);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.queue-table td {
  padding: 0.75rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--divider);
  font-size: 0.86rem;
  vertical-align: top;
}

.mono {
  font-family: monospace;
}

.instance-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.status-chip {
  display: inline-flex;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-chip.ok {
  background: var(--success-bg);
  color: var(--success);
}

.status-chip.blocked {
  background: var(--warning-bg);
  color: var(--warning);
}

small {
  display: block;
  margin-top: 0.3rem;
  color: var(--text-muted);
  max-width: 280px;
}

.danger {
  color: var(--danger) !important;
  font-weight: 700;
}

.actions-cell {
  text-align: right;
}

.empty-state,
.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 180px;
  color: var(--text-secondary);
}

.loading-state {
  flex-direction: column;
  gap: 0.75rem;
  padding: 3rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-default);
  border-top: 2px solid var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.form-error {
  margin: 0 0 1rem;
  color: var(--danger);
  font-size: 0.85rem;
}

.form-success {
  margin: 0 0 1rem;
  color: var(--success);
  font-size: 0.85rem;
}
</style>
