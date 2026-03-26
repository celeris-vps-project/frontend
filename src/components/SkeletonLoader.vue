<template>
  <div class="skeleton-wrapper" :class="variant">
    <!-- Stats variant: 4 stat cards -->
    <template v-if="variant === 'stats'">
      <div class="skeleton-stats-grid">
        <div v-for="i in 4" :key="i" class="skeleton-stat-card glass-card">
          <div class="skeleton-stat-icon shimmer"></div>
          <div class="skeleton-stat-content">
            <div class="skeleton-line skeleton-line-sm shimmer" style="width: 60%"></div>
            <div class="skeleton-line skeleton-line-lg shimmer" style="width: 40%"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Table variant: header + rows -->
    <template v-else-if="variant === 'table'">
      <div class="skeleton-table glass-card">
        <div class="skeleton-table-header">
          <div class="skeleton-line shimmer" style="width: 120px"></div>
          <div class="skeleton-line shimmer" style="width: 80px"></div>
        </div>
        <div class="skeleton-table-body">
          <div v-for="i in (rows || 5)" :key="i" class="skeleton-table-row">
            <div class="skeleton-line shimmer" style="width: 25%"></div>
            <div class="skeleton-line shimmer" style="width: 15%"></div>
            <div class="skeleton-line shimmer" style="width: 20%"></div>
            <div class="skeleton-badge shimmer"></div>
            <div class="skeleton-line shimmer" style="width: 18%"></div>
            <div class="skeleton-line shimmer" style="width: 15%"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Cards variant: instance-like cards -->
    <template v-else-if="variant === 'cards'">
      <div class="skeleton-cards-list">
        <div v-for="i in (rows || 4)" :key="i" class="skeleton-instance-card glass-card">
          <div class="skeleton-card-top">
            <div class="skeleton-card-id">
              <div class="skeleton-line skeleton-line-md shimmer" style="width: 140px"></div>
              <div class="skeleton-line skeleton-line-xs shimmer" style="width: 80px"></div>
            </div>
            <div class="skeleton-badge shimmer"></div>
          </div>
          <div class="skeleton-card-body">
            <div class="skeleton-tags">
              <div class="skeleton-tag shimmer"></div>
              <div class="skeleton-tag shimmer" style="width: 140px"></div>
              <div class="skeleton-tag shimmer" style="width: 80px"></div>
            </div>
            <div class="skeleton-line skeleton-line-sm shimmer" style="width: 120px; margin-top: 8px"></div>
          </div>
          <div class="skeleton-card-bottom">
            <div class="skeleton-line skeleton-line-xs shimmer" style="width: 150px"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Detail variant: detail page with info cards -->
    <template v-else-if="variant === 'detail'">
      <div class="skeleton-detail">
        <div class="skeleton-detail-header">
          <div class="skeleton-line skeleton-line-lg shimmer" style="width: 200px"></div>
          <div class="skeleton-badge shimmer" style="width: 80px"></div>
        </div>
        <div class="skeleton-detail-grid">
          <div v-for="i in 4" :key="i" class="skeleton-detail-card glass-card">
            <div class="skeleton-line skeleton-line-xs shimmer" style="width: 60%"></div>
            <div class="skeleton-line skeleton-line-md shimmer" style="width: 80%"></div>
          </div>
        </div>
        <div class="skeleton-detail-section glass-card">
          <div class="skeleton-line skeleton-line-md shimmer" style="width: 150px; margin-bottom: 16px"></div>
          <div v-for="i in 3" :key="i" class="skeleton-detail-row">
            <div class="skeleton-line shimmer" style="width: 30%"></div>
            <div class="skeleton-line shimmer" style="width: 50%"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Default / generic: simple block shimmer -->
    <template v-else>
      <div class="skeleton-generic glass-card">
        <div class="skeleton-line skeleton-line-md shimmer" style="width: 40%"></div>
        <div class="skeleton-line shimmer" style="width: 100%; margin-top: 16px"></div>
        <div class="skeleton-line shimmer" style="width: 85%"></div>
        <div class="skeleton-line shimmer" style="width: 92%"></div>
        <div class="skeleton-line shimmer" style="width: 70%"></div>
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  /** Skeleton layout variant: 'stats' | 'table' | 'cards' | 'detail' | 'generic' */
  variant: {
    type: String,
    default: 'generic',
  },
  /** Number of rows/cards to render */
  rows: {
    type: Number,
    default: null,
  },
})
</script>

<style scoped>
/* ── Shimmer animation ── */
.shimmer {
  position: relative;
  overflow: hidden;
  background: var(--bg-code);
  border-radius: 6px;
}

.shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 40%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.08) 60%,
    transparent 100%
  );
  animation: shimmer-slide 1.8s ease-in-out infinite;
}

[data-theme="light"] .shimmer::after {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.5) 40%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(255, 255, 255, 0.5) 60%,
    transparent 100%
  );
}

@keyframes shimmer-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* ── Base skeleton lines ── */
.skeleton-line {
  height: 12px;
}

.skeleton-line-xs {
  height: 10px;
}

.skeleton-line-sm {
  height: 12px;
}

.skeleton-line-md {
  height: 16px;
  border-radius: 8px;
}

.skeleton-line-lg {
  height: 22px;
  border-radius: 8px;
}

/* ── Stats variant ── */
.skeleton-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.skeleton-stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.skeleton-stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  flex-shrink: 0;
}

.skeleton-stat-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

/* ── Table variant ── */
.skeleton-table {
  padding: 1.5rem;
}

.skeleton-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.skeleton-table-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-table-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.skeleton-table-row:last-child {
  border-bottom: none;
}

/* ── Cards variant ── */
.skeleton-cards-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-instance-card {
  padding: 1.25rem;
}

.skeleton-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.skeleton-card-id {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-badge {
  width: 64px;
  height: 24px;
  border-radius: 8px;
}

.skeleton-card-body {
  margin-bottom: 0.75rem;
}

.skeleton-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.skeleton-tag {
  width: 90px;
  height: 24px;
  border-radius: 6px;
}

.skeleton-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ── Detail variant ── */
.skeleton-detail-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.skeleton-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.skeleton-detail-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-detail-section {
  padding: 1.5rem;
}

.skeleton-detail-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border-subtle);
}

.skeleton-detail-row:last-child {
  border-bottom: none;
}

/* ── Generic variant ── */
.skeleton-generic {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ── Wrapper fade-in ── */
.skeleton-wrapper {
  animation: skeleton-fade-in 0.3s ease;
}

@keyframes skeleton-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
