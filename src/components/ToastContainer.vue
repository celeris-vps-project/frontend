<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast-item', `toast-${toast.type}`]"
          @mouseenter="pause(toast)"
          @mouseleave="resume(toast)"
        >
          <!-- liquid glass shine layer -->
          <div class="toast-shine"></div>

          <!-- type accent bar -->
          <div :class="['toast-accent-bar', `bar-${toast.type}`]"></div>

          <div class="toast-body">
            <!-- icon -->
            <span class="toast-icon" v-html="icons[toast.type]"></span>

            <!-- message -->
            <span class="toast-message">{{ toast.message }}</span>

            <!-- close button -->
            <button class="toast-close" @click="dismiss(toast.id)" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- countdown progress bar (hidden for persistent toasts with duration 0) -->
          <div v-if="toast.duration > 0" class="toast-progress-track">
            <div
              :class="['toast-progress-bar', `progress-${toast.type}`]"
              :style="{ animationDuration: toast.duration + 'ms', animationPlayState: toast.paused ? 'paused' : 'running' }"
              @animationend="dismiss(toast.id)"
            ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()

const icons = {
  success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
}

function pause(toast) {
  toast.paused = true
}

function resume(toast) {
  toast.paused = false
}
</script>

<style scoped>
/* ── Container ── */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  flex-direction: column-reverse;
  gap: 12px;
  pointer-events: none;
  max-height: calc(100vh - 48px);
  overflow: visible;
}

/* ── Single Toast ── */
.toast-item {
  position: relative;
  width: 340px;
  border-radius: 16px;
  overflow: hidden;
  pointer-events: auto;
  cursor: default;

  /* ── Liquid Glass ── */
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 -1px 0 rgba(255, 255, 255, 0.1);
}

/* dark theme adjustments */
[data-theme="dark"] .toast-item {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -1px 0 rgba(255, 255, 255, 0.04);
}

/* ── Liquid shine overlay ── */
.toast-shine {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 255, 255, 0.05) 40%,
    transparent 60%
  );
  pointer-events: none;
  z-index: 0;
}

[data-theme="dark"] .toast-shine {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.02) 40%,
    transparent 60%
  );
}

/* ── Accent bar (left edge) ── */
.toast-accent-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  z-index: 2;
  border-radius: 4px 0 0 0;
}

.bar-success { background: linear-gradient(180deg, #22c55e, #4ade80); }
.bar-error   { background: linear-gradient(180deg, #ef4444, #f87171); }
.bar-warning { background: linear-gradient(180deg, #f59e0b, #fbbf24); }
.bar-info    { background: linear-gradient(180deg, var(--accent), var(--accent-light)); }

/* ── Body ── */
.toast-body {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px 14px 20px;
}

/* ── Icon ── */
.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.toast-success .toast-icon { color: #22c55e; }
.toast-error   .toast-icon { color: #ef4444; }
.toast-warning .toast-icon { color: #f59e0b; }
.toast-info    .toast-icon { color: var(--accent); }

[data-theme="dark"] .toast-success .toast-icon { color: #4ade80; }
[data-theme="dark"] .toast-error   .toast-icon { color: #f87171; }
[data-theme="dark"] .toast-warning .toast-icon { color: #fbbf24; }
[data-theme="dark"] .toast-info    .toast-icon { color: var(--accent-light); }

/* ── Message ── */
.toast-message {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.45;
  color: var(--text-primary);
  word-break: break-word;
}

/* ── Close button ── */
.toast-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  margin-top: -2px;
}

.toast-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--text-secondary);
}

[data-theme="dark"] .toast-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

/* ── Progress bar track ── */
.toast-progress-track {
  position: relative;
  z-index: 2;
  height: 3px;
  background: rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

[data-theme="dark"] .toast-progress-track {
  background: rgba(255, 255, 255, 0.04);
}

/* ── Progress bar fill ── */
.toast-progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left;
  animation: toast-countdown linear forwards;
  border-radius: 0 3px 3px 0;
}

.progress-success { background: linear-gradient(90deg, #22c55e, #4ade80); }
.progress-error   { background: linear-gradient(90deg, #ef4444, #f87171); }
.progress-warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.progress-info    { background: linear-gradient(90deg, var(--accent), var(--accent-light)); }

@keyframes toast-countdown {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}

/* ── Transition animations ── */
.toast-enter-active {
  animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  animation: toast-slide-out 0.3s cubic-bezier(0.4, 0, 1, 1) forwards;
}

.toast-move {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.85);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toast-slide-out {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(60%) scale(0.9);
  }
}

/* ── Responsive ── */
@media (max-width: 480px) {
  .toast-container {
    left: 12px;
    right: 12px;
    bottom: 12px;
  }
  .toast-item {
    width: 100%;
  }
}
</style>
