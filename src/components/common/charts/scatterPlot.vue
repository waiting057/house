<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ScatterPoint } from '@/views/real-price-registration/realPriceRegistration.models'

/**
 * @description 成交散點圖 props
 * @property {string} title 圖卡標題
 * @property {ScatterPoint[]} points 單筆成交點（已依時間排序）
 * @property {string} unitLabel 右上角 Y 軸單位文字（亦用於 hover 價錢提示）
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

/**
 * @description 目前滑鼠懸停的點與相對繪圖區的提示位置（資料量大時用 hover 顯示價錢，不在每個點上常駐標籤）
 * @property {ScatterPoint} point 懸停中的成交點
 * @property {number} x 提示框相對 plot-wrap 的 left（px）
 * @property {number} y 提示框相對 plot-wrap 的 top（px）
 */
const tooltip = ref<{ point: ScatterPoint; x: number; y: number } | null>(null)

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
 * @description 把價錢格式化成繁中數字（單價留兩位、總價視數值決定）
 */
function formatPrice(value: number) {
  const digits = value >= 100 ? 0 : 2
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

/**
 * @description 懸停時顯示的價錢主文案，例如「39.59 萬元 / 坪」
 */
function priceText(point: ScatterPoint) {
  return `${formatPrice(point.yValue)} ${props.unitLabel}`
}

/**
 * @description 顯示懸停提示；座標以 plot-wrap 為基準，方便在橫向捲動時仍對準點位
 */
function showTooltip(event: MouseEvent, point: ScatterPoint) {
  const wrap = (event.currentTarget as SVGElement).closest('.scatter-card__plot-wrap') as HTMLElement | null
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  tooltip.value = {
    point,
    x: event.clientX - rect.left + wrap.scrollLeft + 12,
    y: event.clientY - rect.top + 12,
  }
}

/**
 * @description 清除懸停提示
 */
function hideTooltip() {
  tooltip.value = null
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
          每個點代表一筆成交；滑鼠移到點上可看價錢與地址。資料量大時以懸停提示為主，避免所有點同時標價造成重疊。
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
      @mouseleave="hideTooltip"
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
            @mousemove="showTooltip($event, point)"
            @mouseenter="showTooltip($event, point)"
            @mouseleave="hideTooltip"
          >
            <!-- 透明擴大命中區，點密集時較容易指到 -->
            <circle
              :cx="xPosition(point.xValue)"
              :cy="yPosition(point.yValue)"
              r="10"
              class="scatter-card__hit"
            />
            <circle
              :cx="xPosition(point.xValue)"
              :cy="yPosition(point.yValue)"
              r="4"
              class="scatter-card__dot"
              :class="{ 'scatter-card__dot--active': tooltip?.point.id === point.id }"
            />
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

      <div
        v-if="tooltip"
        class="scatter-card__tooltip"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
        role="tooltip"
      >
        <p class="scatter-card__tooltip-price">
          {{ priceText(tooltip.point) }}
        </p>
        <p class="scatter-card__tooltip-meta">
          {{ tooltip.point.meta }}
        </p>
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
  position: relative;
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

.scatter-card__hit {
  fill: transparent;
  cursor: pointer;
}

.scatter-card__dot {
  fill: rgba(15, 118, 110, 0.78);
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 1.5;
  pointer-events: none;
}

.scatter-card__dot--active {
  fill: #0f766e;
  stroke: #fff;
  stroke-width: 2;
}

.scatter-card__tooltip {
  position: absolute;
  z-index: 2;
  max-width: 18rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-line);
  border-radius: 0.65rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(28, 25, 23, 0.12);
  pointer-events: none;
}

.scatter-card__tooltip-price {
  margin: 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--color-ink);
}

.scatter-card__tooltip-meta {
  margin: 0.3rem 0 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--color-ink-muted);
}

.scatter-card__axis-label {
  font-size: 0.88rem;
  font-weight: 600;
}
</style>
