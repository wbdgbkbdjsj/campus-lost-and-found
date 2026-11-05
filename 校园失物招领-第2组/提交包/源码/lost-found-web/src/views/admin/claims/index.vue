<script setup lang="ts">
/**
 * C5 认领管理
 *
 * 契约现状（必须说清楚，否则页面会变成假接口）：
 *   - 没有「认领单全量列表」接口。GET /claims 只返回本人（scope=mine），
 *     管理员用它只能看到自己作为申请人的单子。
 *   - 有 GET /admin/stats/overview 里的 claims.by_status，可看各状态总量。
 *   - 有 GET /claims/{id} 单条详情（含完整流水）。
 *   - 有 GET /admin/export/claims.csv 全量导出。
 * 因此本页定位为「按状态看总量 + 按单号查详情 + 导出全量」，不做假的分页列表。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Download, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { exportClaims, getStatsOverview } from '@/api/admin'
import { getClaim } from '@/api/claim'
import type { ClaimDetail, StatsOverview } from '@/types'
import { CLAIM_STATUS_LABEL } from '@/utils/constants'
import { claimStatusText, claimTagType, formatTime } from '@/utils/status'

const stats = ref<StatsOverview | null>(null)
const loading = ref(false)
const exporting = ref(false)
const claimIdInput = ref('')
const detailLoading = ref(false)
const detail = ref<ClaimDetail | null>(null)

const statusRows = computed(() => {
  const byStatus = stats.value?.claims.by_status ?? {}
  return Object.entries(CLAIM_STATUS_LABEL).map(([status, label]) => ({
    status,
    label,
    type: claimTagType(status),
    count: byStatus[status as keyof typeof byStatus] ?? 0
  }))
})

const totalCount = computed(() => stats.value?.claims.total ?? 0)

function percent(count: number) {
  if (!totalCount.value) return 0
  return Math.round((count / totalCount.value) * 100)
}

/** 回收率 / 超时率直接取 rates，避免前端重复算 */
const rateCards = computed(() => {
  const rates = stats.value?.rates
  return [
    { label: '认领完成率', value: `${rates?.completion_rate ?? 0}%` },
    { label: '超时失效率', value: `${rates?.timeout_rate ?? 0}%` },
    { label: '平均审核时长', value: `${rates?.avg_review_minutes ?? 0} 分钟` },
    { label: '已完成单量', value: String(stats.value?.claims.completed ?? 0) }
  ]
})

async function load() {
  loading.value = true
  try {
    stats.value = await getStatsOverview()
  } finally {
    loading.value = false
  }
}

async function fetchClaim() {
  const id = Number(claimIdInput.value)
  if (!Number.isFinite(id) || id <= 0) {
    ElMessage.warning('请输入有效的认领单号')
    return
  }
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getClaim(id)
  } finally {
    detailLoading.value = false
  }
}

async function handleExport() {
  exporting.value = true
  try {
    const blob = await exportClaims()
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `认领单-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('全量认领单已导出')
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="认领管理"
      description="按状态查看认领单总量，按单号追溯详情，或导出全量数据"
    >
      <template #extra>
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
          导出全量 CSV
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="接口现状说明"
      description="契约 v1 未提供「认领单全量分页列表」接口，管理员无法按页浏览所有单据；本页因此提供状态统计 + 单号精确查询 + 全量导出三种可用能力。"
      style="margin-bottom: 12px"
    />

    <div
      v-loading="loading"
      class="stat-row"
    >
      <div
        v-for="card in rateCards"
        :key="card.label"
        class="stat-card"
      >
        <div class="stat-card__label">
          {{ card.label }}
        </div>
        <div class="stat-card__value stat-card__value--small">
          {{ card.value }}
        </div>
      </div>
    </div>

    <el-row :gutter="12">
      <el-col :span="13">
        <div
          v-loading="loading"
          class="page-card"
        >
          <div class="card-title">
            状态分布（共 {{ totalCount }} 单）
          </div>
          <el-table
            :data="statusRows"
            border
            stripe
            size="small"
          >
            <el-table-column
              label="状态"
              width="170"
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
              prop="count"
              label="数量"
              width="90"
            />
            <el-table-column label="占比">
              <template #default="{ row }">
                <div class="progress-line">
                  <el-progress
                    :percentage="percent(row.count)"
                    :stroke-width="10"
                    :show-text="false"
                    style="flex: 1"
                  />
                  <span class="percent-text">{{ percent(row.count) }}%</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :span="11">
        <div class="page-card">
          <div class="card-title">
            按单号查询详情
          </div>
          <div class="toolbar">
            <el-input
              v-model="claimIdInput"
              placeholder="输入认领单号"
              style="width: 180px"
              :prefix-icon="Search"
              @keyup.enter="fetchClaim"
            />
            <el-button
              type="primary"
              :loading="detailLoading"
              @click="fetchClaim"
            >
              查询
            </el-button>
          </div>

          <div
            v-loading="detailLoading"
            class="detail-wrap"
          >
            <EmptyState
              v-if="!detail"
              description="输入单号后展示该认领单详情与流水"
            />
            <template v-else>
              <el-descriptions
                :column="2"
                border
                size="small"
              >
                <el-descriptions-item label="单号">
                  #{{ detail.id }}
                </el-descriptions-item>
                <el-descriptions-item label="状态">
                  <StatusTag
                    :text="claimStatusText(detail.status)"
                    :type="claimTagType(detail.status)"
                  />
                </el-descriptions-item>
                <el-descriptions-item label="申请人">
                  #{{ detail.applicant_id }}
                </el-descriptions-item>
                <el-descriptions-item label="物品">
                  #{{ detail.found_item_id }}
                </el-descriptions-item>
                <el-descriptions-item label="审核员">
                  {{ detail.reviewer_id ? `#${detail.reviewer_id}` : '未接单' }}
                </el-descriptions-item>
                <el-descriptions-item label="提交时间">
                  {{ formatTime(detail.submitted_at) }}
                </el-descriptions-item>
                <el-descriptions-item
                  label="自证特征"
                  :span="2"
                >
                  {{ detail.proof }}
                </el-descriptions-item>
              </el-descriptions>

              <div class="section-title">
                流水（{{ detail.records?.length ?? 0 }} 条）
              </div>
              <el-timeline v-if="detail.records && detail.records.length">
                <el-timeline-item
                  v-for="record in detail.records"
                  :key="record.id"
                  :timestamp="formatTime(record.created_at)"
                  placement="top"
                >
                  <StatusTag :text="record.action" />
                  <span class="record-status">
                    {{ record.from_status ? claimStatusText(record.from_status) : '起点' }}
                    →
                    {{ claimStatusText(record.to_status) }}
                  </span>
                  <div
                    v-if="record.comment"
                    class="record-comment"
                  >
                    {{ record.comment }}
                  </div>
                </el-timeline-item>
              </el-timeline>
              <el-empty
                v-else
                description="暂无流水"
                :image-size="60"
              />
            </template>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.stat-card {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.stat-card__label {
  font-size: 13px;
  color: #909399;
}

.stat-card__value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stat-card__value--small {
  font-size: 20px;
}

.card-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.progress-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.percent-text {
  min-width: 42px;
  font-size: 12px;
  color: #909399;
  text-align: right;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-wrap {
  min-height: 180px;
}

.section-title {
  margin: 14px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.record-status {
  margin-left: 8px;
  font-size: 12px;
  color: #606266;
}

.record-comment {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #909399;
}
</style>
