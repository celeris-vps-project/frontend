<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true }
})

const labelMap = {
  pending: 'Pending',
  running: 'Running',
  stopped: 'Stopped',
  suspended: 'Suspended',
  terminated: 'Terminated'
}

const badgeClass = computed(() => {
  const map = {
    pending: 'badge-pending',
    running: 'badge-running',
    stopped: 'badge-stopped',
    suspended: 'badge-suspended',
    terminated: 'badge-terminated'
  }
  return map[props.status] || 'badge-pending'
})

const displayLabel = computed(() => labelMap[props.status] || props.status)
</script>

<template>
  <span class="status-badge" :class="badgeClass">{{ displayLabel }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.badge-running {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-stopped {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.badge-suspended {
  background: rgba(251, 146, 60, 0.15);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.badge-terminated {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
