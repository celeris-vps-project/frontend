<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  status: { type: String, required: true }
})

const badgeClass = computed(() => 'badge-' + (props.status || 'pending'))
const displayLabel = computed(() => {
  const key = `status.${props.status}`
  return t(key)
})
</script>

<template>
  <span class="status-badge" :class="badgeClass">{{ displayLabel }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-pending, .badge-draft {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.badge-running, .badge-active, .badge-paid {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.badge-stopped, .badge-issued {
  background: var(--info-bg);
  color: var(--info);
  border: 1px solid var(--info-border);
}

.badge-suspended {
  background: var(--warning-bg);
  color: #f97316;
  border: 1px solid rgba(249, 115, 22, 0.25);
}

.badge-terminated, .badge-cancelled, .badge-void {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}
</style>
