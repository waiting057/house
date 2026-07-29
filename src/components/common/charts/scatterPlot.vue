<script setup lang="ts">
import { computed } from 'vue'
import type { ScatterPoint } from '@/views/real-price-registration/realPriceRegistration.models'

/**
 * @description 成交散點圖 props
 * @property {string} title 圖卡標題
 * @property {ScatterPoint[]} points 單筆成交點（已依時間排序）
 * @property {string} unitLabel 右上角 Y 軸單位文字
 * @property {string} [xAxisLabel] 底部 X 軸名稱（預設「成交年月」）
 * @property {string} [emptyText] 無資料時提示
 */
const props = withDefaults(
  defineProps<{
    title: string
    points: ScatterPoint[]
    unitLabel: string
    xAxisLabel?: string
    emptyText?: string
  }>(),
  {
    xAxisLabel: '成交年月',
    emptyText: '目前沒有符合條件的資料。',
  },
)

// 點很多時加寬繪圖區；上限避免無限變寬，下限確保稀疏資料仍可讀
const width = computed(() => Math.max(960, Math.min(1800, props.points.length * 18)))
const height = 300
const padding = { top: 22, right: 24, bottom: 56, left: 44 }

/**
 * @description X 軸時間範圍；僅一筆時把 max 往後推 1ms，避免除以零
 */
const xBounds = computed(() => {
  if (props.points.length === 0) return null
  const min = Math.min(...props.points.map((point) => point.xValue))
  const max = Math.max(...props.points.map((point) => point.xValue))
  return { min, max: max === min ? min + 1 : max }
})

/**
 * @description Y 軸數值範圍，上下各留約 12% 邊距
 */
const yBounds = computed(() => {
  if (props.points.length === 0) return null
  const min = Math.min(...props.points.map((point) => point.yValue))
  const max = Math.max(...props.points.map((point) => point.yValue))
  const span = max - min || 1
  return {
    min: Math.max(0, min - span * 0.12),
    max: max + span * 0.12,
  }
})

/**
 * @description 時間戳 → SVG X 座標
 */
function xPosition(value: number) {
  if (!xBounds.value) return padding.left
  const innerWidth = width.value - padding.left - padding.right
  return padding.left + ((value - xBounds.value.min) / (xBounds.value.max - xBounds.value.min)) * innerWidth
}

/**
 * @description 數值 → SVG Y 座標（越大越靠上）
 */
function yPosition(value: number) {
  if (!yBounds.value) return height - padding.bottom
  const innerHeight = height - padding.top - padding.bottom
  return height - padding.bottom - ((value - yBounds.value.min) / (yBounds.value.max - yBounds.value.min)) * innerHeight
}

/**
 * @description 在 X 軸範圍內均分約 6 個刻度，標籤格式為 YYYY-MM（UTC）
 */
const xTicks = computed(() => {
  const bounds = xBounds.value
  if (!bounds) return []

  const desiredTicks = 6
  const span = bounds.max - bounds.min

  return Array.from({ length: desiredTicks }, (_, index) => {
    const ratio = index / (desiredTicks - 1)
    const value = bounds.min + span * ratio
    const date = new Date(value)
    const label = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    return {
      label,
      x: xPosition(value),
    }
  })
})

const yTicks = computed(() => {
  const bounds = yBounds.value
  if (!bounds) return []
  return Array.from({ length: 4 }, (_, index) => {
    const value = bounds.min + ((bounds.max - bounds.min) / 3) * index
    return {
      label: value.toFixed(1),
      y: yPosition(value),
    }
  })
})
</script>

<template>
  <section class="scatter-card">
    <div class="scatter-card__header">
      <div>
        <h3 class="scatter-card__title">
          {{ title }}
        </h3>
        <p class="scatter-card__hint">
          每個點代表一筆成交資料。
        </p>
      </div>
      <span class="scatter-card__unit">{{ unitLabel }}</span>
    </div>

    <div
      v-if="points.length === 0 || !xBounds || !yBounds"
      class="scatter-card__empty"
    >
      {{ emptyText }}
    </div>

    <div
      v-else
      class="scatter-card__plot-wrap"
    >
      <div
        class="scatter-card__canvas"
        :style="{ width: `${width}px` }"
      >
        <svg
          :viewBox="`0 0 ${width} ${height}`"
          class="scatter-card__svg"
          role="img"
          :aria-label="title"
        >
        <line
          v-for="tick in yTicks"
          :key="tick.label"
          :x1="padding.left"
          :x2="width - padding.right"
          :y1="tick.y"
          :y2="tick.y"
          class="scatter-card__grid"
        />
        <text
          v-for="tick in yTicks"
          :key="`${tick.label}-label`"
          :x="8"
          :y="tick.y + 4"
          class="scatter-card__axis"
        >
          {{ tick.label }}
        </text>

        <g
          v-for="point in points"
          :key="point.id"
        >
          <circle
            :cx="xPosition(point.xValue)"
            :cy="yPosition(point.yValue)"
            r="4"
            class="scatter-card__dot"
          >
            <title>{{ `${point.meta}｜${point.yValue}` }}</title>
          </circle>
        </g>

        <text
          v-for="tick in xTicks"
          :key="`${tick.label}-x`"
          :x="tick.x"
          :y="height - 26"
          text-anchor="middle"
          class="scatter-card__axis"
        >
          {{ tick.label }}
        </text>
        <text
          :x="width / 2"
          :y="height - 4"
          text-anchor="middle"
          class="scatter-card__axis scatter-card__axis-label"
        >
          {{ xAxisLabel }}
        </text>
        </svg>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scatter-card {
  padding: 1rem 1.1rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.scatter-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.scatter-card__title {
  margin: 0;
  font-size: 1.05rem;
}

.scatter-card__hint,
.scatter-card__unit,
.scatter-card__axis,
.scatter-card__empty {
  color: var(--color-ink-muted);
  font-size: 0.84rem;
}

.scatter-card__hint {
  margin: 0.35rem 0 0;
}

.scatter-card__empty {
  padding: 3rem 0.5rem;
}

.scatter-card__plot-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.35rem;
}

.scatter-card__canvas {
  width: max-content;
  min-width: 100%;
}

.scatter-card__svg {
  width: 100%;
  height: auto;
}

.scatter-card__grid {
  stroke: rgba(87, 83, 78, 0.12);
  stroke-width: 1;
}

.scatter-card__dot {
  fill: rgba(15, 118, 110, 0.78);
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 1.5;
}

.scatter-card__axis-label {
  font-size: 0.88rem;
  font-weight: 600;
}
</style>
