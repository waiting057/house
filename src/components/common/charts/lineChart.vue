<script setup lang="ts">
import { computed } from 'vue'
import type { MonthlyMetricPoint } from '@/views/real-price-registration/realPriceRegistration.models'

/**
 * @description 月度折線圖 props
 * @property {string} title 圖卡標題
 * @property {MonthlyMetricPoint[]} points 依年月排序的資料點
 * @property {string} primaryLabel 主線圖例（通常為中位數）
 * @property {string} [secondaryLabel] 輔線圖例（通常為平均；空字串則不畫輔線）
 * @property {string} unitLabel 右上角 Y 軸單位文字
 * @property {string} [xAxisLabel] 底部 X 軸名稱（預設「成交年月」）
 * @property {string} [emptyText] 無資料時提示
 */
const props = withDefaults(
  defineProps<{
    title: string
    points: MonthlyMetricPoint[]
    primaryLabel: string
    secondaryLabel?: string
    unitLabel: string
    xAxisLabel?: string
    emptyText?: string
  }>(),
  {
    secondaryLabel: '',
    xAxisLabel: '成交年月',
    emptyText: '目前沒有符合條件的資料。',
  },
)

// 資料點多時加寬繪圖區，讓橫向捲動只發生在圖表 viewport，不撐開整頁
const width = computed(() => Math.max(720, props.points.length * 90))
const height = 280
const padding = { top: 24, right: 18, bottom: 52, left: 40 }

const allValues = computed(() =>
  props.points.flatMap((point) => [point.primary, point.secondary ?? null]).filter((value): value is number => value != null),
)

/**
 * @description 依主／輔線數值計算 Y 軸可視範圍，上下各留約 15% 邊距；全為同值時仍給最小 span
 */
const chartBounds = computed(() => {
  if (allValues.value.length === 0) return null
  const min = Math.min(...allValues.value)
  const max = Math.max(...allValues.value)
  const span = max - min || 1
  return {
    min: Math.max(0, min - span * 0.15),
    max: max + span * 0.15,
  }
})

/**
 * @description 把資料點索引對應到 SVG X 座標（單點置中；多點均分內寬）
 */
function xPosition(index: number) {
  const innerWidth = width.value - padding.left - padding.right
  if (props.points.length <= 1) return padding.left + innerWidth / 2
  return padding.left + (index / (props.points.length - 1)) * innerWidth
}

/**
 * @description 把數值對應到 SVG Y 座標（數值越大越靠上）
 */
function yPosition(value: number) {
  const bounds = chartBounds.value
  if (!bounds) return height - padding.bottom
  const ratio = (value - bounds.min) / (bounds.max - bounds.min || 1)
  const innerHeight = height - padding.top - padding.bottom
  return height - padding.bottom - ratio * innerHeight
}

/**
 * @description 組出折線 polyline 的 points 字串；缺值的月份略過該頂點
 */
function buildLine(type: 'primary' | 'secondary') {
  const points = props.points
    .map((point, index) => {
      const value = type === 'primary' ? point.primary : point.secondary
      if (value == null) return null
      return `${xPosition(index)},${yPosition(value)}`
    })
    .filter(Boolean)
  return points.join(' ')
}

const primaryLine = computed(() => buildLine('primary'))
const secondaryLine = computed(() => buildLine('secondary'))

const yAxisTicks = computed(() => {
  const bounds = chartBounds.value
  if (!bounds) return []
  return Array.from({ length: 4 }, (_, index) => {
    const value = bounds.min + ((bounds.max - bounds.min) / 3) * index
    return {
      label: value.toFixed(1),
      y: yPosition(value),
    }
  })
})

function formatPointValue(value: number | null) {
  if (value == null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

</script>

<template>
  <section class="chart-card">
    <div class="chart-card__header">
      <div>
        <h3 class="chart-card__title">
          {{ title }}
        </h3>
        <p class="chart-card__legend">
          <span class="chart-card__legend-item">
            <i class="chart-card__legend-line chart-card__legend-line--primary" />
            {{ primaryLabel }}
          </span>
          <span
            v-if="secondaryLabel"
            class="chart-card__legend-item"
          >
            <i class="chart-card__legend-line chart-card__legend-line--secondary" />
            {{ secondaryLabel }}
          </span>
        </p>
      </div>
      <span class="chart-card__unit">{{ unitLabel }}</span>
    </div>

    <div
      v-if="points.length === 0 || !chartBounds"
      class="chart-card__empty"
    >
      {{ emptyText }}
    </div>

    <div
      v-else
      class="chart-card__plot-wrap"
    >
      <div
        class="chart-card__canvas"
        :style="{ width: `${width}px` }"
      >
        <svg
          :viewBox="`0 0 ${width} ${height}`"
          class="chart-card__svg"
          role="img"
          :aria-label="title"
        >
          <line
            v-for="tick in yAxisTicks"
            :key="tick.label"
            :x1="padding.left"
            :x2="width - padding.right"
            :y1="tick.y"
            :y2="tick.y"
            class="chart-card__grid"
          />
          <text
            v-for="tick in yAxisTicks"
            :key="`${tick.label}-text`"
            :x="8"
            :y="tick.y + 4"
            class="chart-card__axis"
          >
            {{ tick.label }}
          </text>

          <polyline
            v-if="secondaryLine"
            :points="secondaryLine"
            class="chart-card__line chart-card__line--secondary"
          />
          <polyline
            :points="primaryLine"
            class="chart-card__line chart-card__line--primary"
          />

          <g
            v-for="(point, index) in points"
            :key="point.label"
          >
            <circle
              v-if="point.primary != null"
              :cx="xPosition(index)"
              :cy="yPosition(point.primary)"
              r="3.5"
              class="chart-card__dot"
            />
            <text
              v-if="point.primary != null"
              :x="xPosition(index)"
              :y="yPosition(point.primary) - 10"
              text-anchor="middle"
              class="chart-card__value"
            >
              {{ formatPointValue(point.primary) }}
            </text>
            <text
              v-if="index % Math.max(1, Math.ceil(points.length / 6)) === 0 || index === points.length - 1"
              :x="xPosition(index)"
              :y="height - 24"
              text-anchor="middle"
              class="chart-card__axis"
            >
              {{ point.label }}
            </text>
          </g>

          <text
            :x="width / 2"
            :y="height - 4"
            text-anchor="middle"
            class="chart-card__axis chart-card__axis-label"
          >
            {{ xAxisLabel }}
          </text>
        </svg>
      </div>
    </div>
  </section>
</template>

<style scoped>
.chart-card {
  padding: 1rem 1.1rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
}

.chart-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.chart-card__title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
}

.chart-card__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.88rem;
}

.chart-card__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.chart-card__legend-line {
  display: inline-block;
  width: 1.6rem;
  border-top: 2px solid currentColor;
}

.chart-card__legend-line--primary {
  color: var(--color-accent);
}

.chart-card__legend-line--secondary {
  color: #8b5cf6;
  border-top-style: dashed;
}

.chart-card__unit,
.chart-card__empty,
.chart-card__axis {
  color: var(--color-ink-muted);
  font-size: 0.82rem;
}

.chart-card__value {
  fill: var(--color-ink);
  font-size: 0.76rem;
  font-weight: 600;
}

.chart-card__empty {
  padding: 3rem 0.5rem;
}

.chart-card__plot-wrap {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.35rem;
}

.chart-card__canvas {
  width: max-content;
  min-width: 100%;
}

.chart-card__svg {
  width: 100%;
  height: auto;
}

.chart-card__grid {
  stroke: rgba(87, 83, 78, 0.12);
  stroke-width: 1;
}

.chart-card__line {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart-card__line--primary {
  stroke: var(--color-accent);
}

.chart-card__line--secondary {
  stroke: #8b5cf6;
  stroke-dasharray: 8 6;
}

.chart-card__dot {
  fill: var(--color-accent);
  stroke: white;
  stroke-width: 2;
}

.chart-card__axis-label {
  font-size: 0.86rem;
  font-weight: 600;
}
</style>
