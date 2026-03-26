<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  status: { type: String, required: true }
})

const badgeClass = computed(() => {
  const map = { online: 'badge-online', offline: 'badge-offline' }
  return map[props.status] || 'badge-offline'
})

const displayLabel = computed(() => {
  if (props.status) {
    return t(`status.${props.status}`)
  }
  return t('common.unknown')
})
</script>

<template>
  <span class="node-badge" :class="badgeClass">{{ displayLabel }}</span>
</template>

<style scoped>
.node-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-online {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.badge-offline {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}
</style>
