<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true }
})

const badgeClass = computed(() => {
  const map = {
    online: 'badge-online',
    offline: 'badge-offline'
  }
  return map[props.status] || 'badge-offline'
})

const displayLabel = computed(() => {
  return props.status ? props.status.charAt(0).toUpperCase() + props.status.slice(1) : 'Unknown'
})
</script>

<template>
  <span class="node-badge" :class="badgeClass">{{ displayLabel }}</span>
</template>

<style scoped>
.node-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-online {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-offline {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
