<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AdminLayout from '../../components/AdminLayout.vue'
import { getMessageRecord, listMessageRecords, replayMessage } from '../../api/message'

const loading = ref(true)
const detailLoading = ref(false)
const error = ref('')
const records = ref([])
const selectedId = ref(null)
const detail = ref(null)
const replayingId = ref(null)

const filters = reactive({
  bizId: '',
  recipient: '',
  channel: '',
  status: '',
  fromAt: '',
  toAt: '',
  limit: 100,
})

const channelOptions = ['EMAIL', 'SMS', 'WEBHOOK', 'IN_APP']
const statusOptions = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'EXHAUSTED']

const selectedRecord = computed(() => detail.value?.record || null)
const selectedOutbox = computed(() => detail.value?.outbox || null)

onMounted(async () => {
  await loadMessages()
})

async function loadMessages() {
  loading.value = true
  error.value = ''
  try {
    const data = await listMessageRecords({
      bizId: filters.bizId.trim(),
      recipient: filters.recipient.trim(),
      channel: filters.channel,
      status: filters.status,
      fromAt: filters.fromAt || undefined,
      toAt: filters.toAt || undefined,
      limit: Number(filters.limit) || 100,
    })
    records.value = Array.isArray(data) ? data : []
    if (records.value.length > 0) {
      const nextId = selectedId.value && records.value.some(item => item.id === selectedId.value)
        ? selectedId.value
        : records.value[0].id
      await selectRecord(nextId)
    } else {
      selectedId.value = null
      detail.value = null
    }
  } catch (err) {
    error.value = err.message
    records.value = []
    detail.value = null
  } finally {
    loading.value = false
  }
}

async function selectRecord(id) {
  if (!id) return
  selectedId.value = id
  detailLoading.value = true
  error.value = ''
  try {
    detail.value = await getMessageRecord(id)
  } catch (err) {
    error.value = err.message
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

async function replayRecord(record) {
  if (!record?.id) return
  replayingId.value = record.id
  error.value = ''
  try {
    await replayMessage(record.id)
    await loadMessages()
    await selectRecord(record.id)
  } catch (err) {
    error.value = err.message
  } finally {
    replayingId.value = null
  }
}

function formatTime(value) {
  return value || '-'
}

function formatJson(value) {
  if (!value) return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}
</script>

<template>
  <AdminLayout>
    <div class="message-center-page">
      <header class="page-header">
        <div>
          <h1 class="page-title">消息管理</h1>
          <p class="page-subtitle">查看消息记录、重放失败消息。</p>
        </div>
        <button class="action-btn secondary-btn" @click="loadMessages">
          刷新
        </button>
      </header>

      <section class="glass-card filter-card">
        <div class="filter-grid">
          <input v-model="filters.bizId" class="text-input" placeholder="bizId" />
          <input v-model="filters.recipient" class="text-input" placeholder="接收人" />
          <select v-model="filters.channel" class="text-input">
            <option value="">全部渠道</option>
            <option v-for="opt in channelOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <select v-model="filters.status" class="text-input">
            <option value="">全部状态</option>
            <option v-for="opt in statusOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <input v-model="filters.fromAt" class="text-input" type="datetime-local" />
          <input v-model="filters.toAt" class="text-input" type="datetime-local" />
          <input v-model="filters.limit" class="text-input" type="number" min="1" max="200" />
          <button class="action-btn primary-btn" @click="loadMessages">查询</button>
        </div>
      </section>

      <div class="content-grid">
        <section class="glass-card table-card">
          <div v-if="loading" class="state-box">加载中...</div>
          <div v-else-if="error" class="state-box error">{{ error }}</div>
          <div v-else-if="records.length === 0" class="state-box">没有消息记录</div>
          <table v-else class="records-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>bizId</th>
                <th>渠道</th>
                <th>接收人</th>
                <th>状态</th>
                <th>重试</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in records"
                :key="record.id"
                :class="{ active: selectedId === record.id }"
                @click="selectRecord(record.id)"
              >
                <td>{{ record.id }}</td>
                <td>{{ record.bizId || '-' }}</td>
                <td>{{ record.channel }}</td>
                <td>{{ record.recipient }}</td>
                <td><span class="status-pill" :class="record.status">{{ record.status }}</span></td>
                <td>{{ record.retryCount }}</td>
                <td>{{ formatTime(record.createdAt) }}</td>
                <td>
                  <button
                    v-if="record.status === 'FAILED' || record.status === 'EXHAUSTED'"
                    class="mini-btn"
                    :disabled="replayingId === record.id"
                    @click.stop="replayRecord(record)"
                  >
                    {{ replayingId === record.id ? '重放中...' : '重放' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="glass-card detail-card">
          <div v-if="detailLoading" class="state-box">加载详情中...</div>
          <template v-else-if="selectedRecord">
            <div class="detail-header">
              <div>
                <h2>消息详情</h2>
                <p>{{ selectedRecord.bizId || '-' }}</p>
              </div>
              <button
                v-if="selectedRecord.status === 'FAILED' || selectedRecord.status === 'EXHAUSTED'"
                class="mini-btn"
                @click="replayRecord(selectedRecord)"
              >
                重放
              </button>
            </div>

            <div class="detail-grid">
              <div><span class="label">ID</span><span>{{ selectedRecord.id }}</span></div>
              <div><span class="label">状态</span><span>{{ selectedRecord.status }}</span></div>
              <div><span class="label">渠道</span><span>{{ selectedRecord.channel }}</span></div>
              <div><span class="label">接收人</span><span>{{ selectedRecord.recipient }}</span></div>
              <div><span class="label">主题</span><span>{{ selectedRecord.subject || '-' }}</span></div>
              <div><span class="label">模板</span><span>{{ selectedRecord.templateCode || '-' }}</span></div>
              <div><span class="label">创建时间</span><span>{{ formatTime(selectedRecord.createdAt) }}</span></div>
              <div><span class="label">发送时间</span><span>{{ formatTime(selectedRecord.sentAt) }}</span></div>
              <div><span class="label">最后重试</span><span>{{ formatTime(selectedRecord.lastRetryAt) }}</span></div>
              <div><span class="label">下次重试</span><span>{{ formatTime(selectedRecord.nextRetryAt) }}</span></div>
            </div>

            <div class="section-block">
              <span class="label">内容</span>
              <pre class="code-block">{{ selectedRecord.content || '-' }}</pre>
            </div>

            <div class="section-block">
              <span class="label">错误</span>
              <pre class="code-block">{{ selectedRecord.errorMsg || '-' }}</pre>
            </div>

            <div class="section-block">
              <span class="label">Outbox</span>
              <pre class="code-block">{{ formatJson(selectedOutbox) }}</pre>
            </div>
          </template>
          <div v-else class="state-box">选择一条消息查看详情</div>
        </section>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.message-center-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
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

.filter-card {
  padding: 1rem;
  margin-bottom: 1rem;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.text-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.58rem 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.95fr);
  gap: 1rem;
}

.table-card,
.detail-card {
  padding: 1rem;
  min-height: 640px;
}

.state-box {
  padding: 1rem;
  color: var(--text-secondary);
}

.state-box.error {
  color: var(--danger);
}

.records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.records-table th,
.records-table td {
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--divider);
  text-align: left;
  vertical-align: top;
}

.records-table tbody tr {
  cursor: pointer;
}

.records-table tbody tr.active {
  background: var(--bg-input);
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.78rem;
  border: 1px solid transparent;
}

.status-pill.PENDING,
.status-pill.SENDING {
  background: var(--warning-bg);
  color: var(--warning);
  border-color: var(--warning-border);
}

.status-pill.SENT {
  background: var(--success-bg);
  color: var(--success);
  border-color: var(--success-border);
}

.status-pill.FAILED,
.status-pill.EXHAUSTED {
  background: var(--danger-bg);
  color: var(--danger);
  border-color: var(--danger-border);
}

.mini-btn {
  padding: 0.4rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
}

.mini-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail-header h2 {
  margin: 0;
  font-size: 1.15rem;
}

.detail-header p {
  margin: 0.25rem 0 0;
  color: var(--text-secondary);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.detail-grid > div,
.section-block {
  min-width: 0;
}

.label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
}

.code-block {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.84rem;
  border: 1px solid var(--border-default);
}

.section-block {
  margin-top: 1rem;
}

@media (max-width: 1180px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
