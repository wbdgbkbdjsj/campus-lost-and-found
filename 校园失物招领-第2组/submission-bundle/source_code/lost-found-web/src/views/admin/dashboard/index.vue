<script setup lang="ts">
/**
 * C1 数据看板
 *
 * 唯一数据源 GET /admin/stats/overview（契约 #28，super_admin 专属）。
 * 返回体结构见 types/business.ts 的 StatsOverview：
 *   users / items / claims / rates / audit_total 五块。
 * 图表不引第三方库，用 el-progress 与 CSS 柱条表达占比，减少打包体积。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { exportClaims, getStatsOverview } from '@/api/admin'
import { CLAIM_STATUS_LABEL } from '@/utils/constants'
import { claimTagType, claimStatusText } from '@/utils/status'
import type { StatsOverview } from '@/types'

const stats = ref<StatsOverview | null>(null)
const loading = ref(false)
const exporting = ref(false)
const dateRange = ref('')

const claimStatusRows = computed(() => {
  const map = stats.value?.claims.by_status ?? {}
  return Object.entries(map).map(([status, count]) => ({
    status,
    label: claimStatusText(status),
    type: claimTagType(status),
    count: count ?? 0
  }))
})

const maxStatusCount = computed(() =>
  claimStatusRows.value.reduce((max, row) => Math.max(max, row.count), 1)
)

/** 用户构成：学生 / 审核员 / 管理员 / 停用 */
const userComposition = computed(() => {
  const users = stats.value?.users
  if (!users) return []
  return [
    { label: '学生', value: users.student, color: '#409eff' },
    { label: '审核员', value: users.reviewer, color: '#e6a23c' },
    { label: '超级管理员', value: users.admin, color: '#f56c6c' },
    { label: '已停用', value: users.disabled, color: '#909399' }
  ]
})

function percent(value: number, total: number) {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

async function load() {
  loading.value = true
  try {
    stats.value = await getStatsOverview(
      dateRange.value ? { date_range: dateRange.value } : undefined
    )
  } finally {
    loading.value = false
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportClaims(dateRange.value ? { date_range: dateRange.value } : undefined)
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `认领单导出-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('导出已开始下载（CSV）')
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div
    v-loading="loading"
    class="page-container"
  >
    <PageHeader
      title="数据看板"
      description="用户、物品、认领单的关键指标与完成率"
    >
      <template #extra>
        <el-input
          v-model="dateRange"
          placeholder="时间范围，如 2026-11"
          clearable
          style="width: 180px"
          @keyup.enter="load"
        />
        <el-button
          :icon="Refresh"
          @click="load"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          :icon="Download"
          :loading="exporting"
          @click="handleExport"
        >
          导出认领单
        </el-button>
      </template>
    </PageHeader>

    <template v-if="stats">
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-card__label">
            注册用户
          </div>
          <div class="kpi-card__value">
            {{ stats.users.total }}
          </div>
          <div class="kpi-card__extra">
            停用 {{ stats.users.disabled }} 人
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__label">
            拾获登记 / 失物启事
          </div>
          <div class="kpi-card__value">
            {{ stats.items.found_total }} / {{ stats.items.lost_total }}
          </div>
          <div class="kpi-card__extra">
            已认领 {{ stats.items.found_claimed }} 件
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__label">
            认领单总量
          </div>
          <div class="kpi-card__value">
            {{ stats.claims.total }}
          </div>
          <div class="kpi-card__extra">
            在途 {{ stats.claims.pending }} · 已完成 {{ stats.claims.completed }}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__label">
            操作日志
          </div>
          <div class="kpi-card__value">
            {{ stats.audit_total }}
          </div>
          <div class="kpi-card__extra">
            覆盖全部写操作
          </div>
        </div>
      </div>

      <el-row :gutter="12">
        <el-col :span="12">
          <div class="page-card">
            <div class="card-title">
              关键效率指标
            </div>
            <div class="rate-item">
              <div class="rate-item__head">
                <span>认领完成率</span>
                <span class="rate-item__value">{{ stats.rates.completion_rate }}%</span>
              </div>
              <el-progress
                :percentage="Math.min(100, Math.round(stats.rates.completion_rate))"
                :stroke-width="12"
                status="success"
                :show-text="false"
              />
            </div>
            <div class="rate-item">
              <div class="rate-item__head">
                <span>超时失效率</span>
                <span class="rate-item__value">{{ stats.rates.timeout_rate }}%</span>
              </div>
              <el-progress
                :percentage="Math.min(100, Math.round(stats.rates.timeout_rate))"
                :stroke-width="12"
                status="exception"
                :show-text="false"
              />
            </div>
            <div class="rate-item">
              <div class="rate-item__head">
                <span>平均审核时长</span>
                <span class="rate-item__value">{{ stats.rates.avg_review_minutes }} 分钟</span>
              </div>
              <el-progress
                :percentage="Math.min(100, Math.round((stats.rates.avg_review_minutes / 240) * 100))"
                :stroke-width="12"
                :show-text="false"
              />
              <div class="rate-item__tip">
                进度条以 240 分钟为满格参考
              </div>
            </div>
          </div>
        </el-col>

        <el-col :span="12">
          <div class="page-card">
            <div class="card-title">
              用户构成
            </div>
            <div
              v-for="item in userComposition"
              :key="item.label"
              class="bar-item"
            >
              <div class="bar-item__label">
                {{ item.label }}
              </div>
              <div class="bar-item__track">
                <div
                  class="bar-item__fill"
                  :style="{
                    width: `${percent(item.value, stats.users.total)}%`,
                    background: item.color
                  }"
                />
              </div>
              <div class="bar-item__value">
                {{ item.value }}（{{ percent(item.value, stats.users.total) }}%）
              </div>
            </div>
            <div class="divider" />
            <div class="mini-row">
              <div class="mini-item">
                <div class="mini-item__label">
                  已登记待认领
                </div>
                <div class="mini-item__value">
                  {{ stats.items.found_registered }}
                </div>
              </div>
              <div class="mini-item">
                <div class="mini-item__label">
                  已失效单据
                </div>
                <div class="mini-item__value">
                  {{ stats.claims.expired }}
                </div>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>

      <div class="page-card">
        <div class="card-title">
          认领单状态分布
        </div>
        <el-table
          :data="claimStatusRows"
          border
          stripe
          size="small"
        >
          <el-table-column
            label="状态"
            width="180"
          >
            <template #default="{ row }">
              <el-tag
                :type="row.type"
                size="small"
              >
                {{ row.label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="数量"
            width="100"
          >
            <template #default="{ row }">
              {{ row.count }}
            </template>
          </el-table-column>
          <el-table-column label="占比">
            <template #default="{ row }">
              <div class="bar-item bar-item--inline">
                <div class="bar-item__track">
                  <div
                    class="bar-item__fill"
                    :style="{
                      width: `${percent(row.count, maxStatusCount)}%`,
                      background: '#409eff'
                    }"
                  />
                </div>
                <span class="bar-item__value">
                  {{ percent(row.count, stats.claims.total) }}%
                </span>
              </div>
            </template>
          </el-table-column>

          <template #empty>
            <el-empty
              description="暂无认领单数据"
              :image-size="70"
            />
          </template>
        </el-table>
        <div class="status-legend">
          <span class="hint">状态字典：{{ Object.keys(CLAIM_STATUS_LABEL).join(' / ') }}</span>
        </div>
      </div>
    </template>

    <el-empty
      v-else-if="!loading"
      description="未获取到统计数据"
    />
  </div>
</template>

<style scoped lang="scss">
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.kpi-card {
  padding: 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.kpi-card__label {
  font-size: 13px;
  color: #909399;
}

.kpi-card__value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 600;
  color: #303133;
}

.kpi-card__extra {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.card-title {
  margin-bottom: 14px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.rate-item {
  margin-bottom: 18px;
}

.rate-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  color: #606266;
}

.rate-item__value {
  font-weight: 600;
  color: #303133;
}

.rate-item__tip {
  margin-top: 4px;
  font-size: 12px;
  color: #c0c4cc;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.bar-item--inline {
  margin-bottom: 0;
}

.bar-item__label {
  width: 90px;
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
}

.bar-item__track {
  flex: 1;
  height: 10px;
  background: #f0f2f5;
  border-radius: 5px;
  overflow: hidden;
}

.bar-item__fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s;
}

.bar-item__value {
  min-width: 92px;
  font-size: 12px;
  color: #909399;
  text-align: right;
}

.divider {
  height: 1px;
  background: #ebeef5;
  margin: 14px 0;
}

.mini-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mini-item {
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
}

.mini-item__label {
  font-size: 12px;
  color: #909399;
}

.mini-item__value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.status-legend {
  margin-top: 10px;
}

.hint {
  font-size: 12px;
  color: #909399;
}
</style>
