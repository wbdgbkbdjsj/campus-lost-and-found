<script setup lang="ts">
/**
 * B1 审核工作台
 *
 * 数据源 GET /review/queue（契约 #17）：只包含 SUBMITTED 与 PENDING_INFO 两类在途单，
 * 不包含已终态记录。字段里的 waiting_minutes 由后端算好，前端直接用它对超时预警。
 * 接单是 SUBMITTED → UNDER_REVIEW 的唯一入口（#18 accept），接单人就此锁定。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, AlarmClock } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { acceptClaim, getReviewQueue, runExpire } from '@/api/audit'
import { getClaim } from '@/api/claim'
import type { ClaimDetail, ReviewQueueItem } from '@/types'
import { CLAIM_STATUS_LABEL } from '@/utils/constants'
import { canDo, claimStatusText, claimTagType, formatTime } from '@/utils/status'

/** 超过该分钟数视为需要优先处理（仅前端提示，不影响后端判定） */
const WARN_MINUTES = 120

const list = ref<ReviewQueueItem[]>([])
const loading = ref(false)
const acceptingId = ref<number | null>(null)
const expiring = ref(false)
const statusFilter = ref('')

const drawerVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<ClaimDetail | null>(null)

const summary = computed(() => {
  const bucket = { total: list.value.length, submitted: 0, pendingInfo: 0, slow: 0 }
  list.value.forEach((item) => {
    if (item.status === 'SUBMITTED') bucket.submitted += 1
    if (item.status === 'PENDING_INFO') bucket.pendingInfo += 1
    if (item.waiting_minutes >= WARN_MINUTES) bucket.slow += 1
  })
  return bucket
})

const filteredList = computed(() =>
  statusFilter.value ? list.value.filter((item) => item.status === statusFilter.value) : list.value
)

/** 等得久的排前面，方便按优先级处理 */
const sortedList = computed(() =>
  [...filteredList.value].sort((a, b) => b.waiting_minutes - a.waiting_minutes)
)

function waitingText(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
}

function waitingType(minutes: number) {
  if (minutes >= WARN_MINUTES) return 'danger'
  if (minutes >= 30) return 'warning'
  return 'info'
}

async function load() {
  loading.value = true
  try {
    const result = await getReviewQueue()
    list.value = result.items
  } finally {
    loading.value = false
  }
}

async function handleAccept(row: ReviewQueueItem) {
  try {
    await ElMessageBox.confirm(
      `接单后认领单 #${row.id} 将锁定由你审核（状态变为「审核中」），确认接单吗？`,
      '接单确认',
      { type: 'info', confirmButtonText: '接单', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  acceptingId.value = row.id
  try {
    await acceptClaim(row.id)
    ElMessage.success(`已接单 #${row.id}，请继续做身份核验与审核决定`)
    await load()
  } finally {
    acceptingId.value = null
  }
}

async function handleExpire() {
  try {
    await ElMessageBox.confirm(
      '该操作会把「待补充材料」与「待领取」中已过截止时间的认领单批量置为「已失效」，不可撤销。继续吗？',
      '执行超时批处理',
      { type: 'warning', confirmButtonText: '执行', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  expiring.value = true
  try {
    const result = await runExpire()
    if (result.expired > 0) {
      ElMessage.success(`已失效 ${result.expired} 条：${result.ids.join(', ')}`)
    } else {
      ElMessage.info('当前没有超时的认领单')
    }
    await load()
  } finally {
    expiring.value = false
  }
}

async function openDetail(row: ReviewQueueItem) {
  drawerVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getClaim(row.id)
  } finally {
    detailLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="审核工作台"
      description="待处理认领单按等待时长排序，先接单再核验身份"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="load"
        >
          刷新
        </el-button>
        <el-button
          :icon="AlarmClock"
          type="warning"
          plain
          :loading="expiring"
          @click="handleExpire"
        >
          执行超时批处理
        </el-button>
      </template>
    </PageHeader>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-card__label">
          队列总量
        </div>
        <div class="stat-card__value">
          {{ summary.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          待接单
        </div>
        <div class="stat-card__value stat-card__value--primary">
          {{ summary.submitted }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          待补充材料
        </div>
        <div class="stat-card__value stat-card__value--warning">
          {{ summary.pendingInfo }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          超 {{ WARN_MINUTES }} 分钟
        </div>
        <div class="stat-card__value stat-card__value--danger">
          {{ summary.slow }}
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="toolbar">
        <el-radio-group v-model="statusFilter">
          <el-radio-button value="">
            全部
          </el-radio-button>
          <el-radio-button value="SUBMITTED">
            {{ CLAIM_STATUS_LABEL.SUBMITTED }}
          </el-radio-button>
          <el-radio-button value="PENDING_INFO">
            {{ CLAIM_STATUS_LABEL.PENDING_INFO }}
          </el-radio-button>
        </el-radio-group>
        <span class="hint">队列只含在途单，已终态的认领不再出现</span>
      </div>

      <el-table
        v-loading="loading"
        :data="sortedList"
        border
        stripe
      >
        <el-table-column
          prop="id"
          label="单号"
          width="90"
        />
        <el-table-column
          prop="title"
          label="物品标题"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="applicant"
          label="申请人"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="proof"
          label="自证特征"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          label="状态"
          width="130"
        >
          <template #default="{ row }">
            <StatusTag
              :text="claimStatusText(row.status)"
              :type="claimTagType(row.status)"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="已等待"
          width="130"
        >
          <template #default="{ row }">
            <el-tag
              :type="waitingType(row.waiting_minutes)"
              size="small"
              effect="plain"
            >
              {{ waitingText(row.waiting_minutes) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="提交时间"
          width="150"
        >
          <template #default="{ row }">
            {{ formatTime(row.submitted_at) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="160"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="openDetail(row)"
            >
              详情
            </el-button>
            <el-button
              v-if="canDo(row.allowed_events, 'ACCEPT')"
              link
              type="success"
              :loading="acceptingId === row.id"
              @click="handleAccept(row)"
            >
              接单
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <EmptyState description="队列已清空，暂时没有待处理认领单" />
        </template>
      </el-table>
    </div>

    <el-drawer
      v-model="drawerVisible"
      title="认领单详情"
      size="540px"
    >
      <div
        v-loading="detailLoading"
        class="drawer-body"
      >
        <template v-if="detail">
          <el-descriptions
            :column="1"
            border
            size="small"
          >
            <el-descriptions-item label="单号">
              #{{ detail.id }}
            </el-descriptions-item>
            <el-descriptions-item label="物品编号">
              {{ detail.found_item_id }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <StatusTag
                :text="claimStatusText(detail.status)"
                :type="claimTagType(detail.status)"
              />
            </el-descriptions-item>
            <el-descriptions-item label="自证特征">
              {{ detail.proof }}
            </el-descriptions-item>
            <el-descriptions-item label="补充说明">
              {{ detail.description || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="联系方式">
              {{ detail.contact || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">
              {{ formatTime(detail.submitted_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="截止时间">
              {{ detail.deadline ? formatTime(detail.deadline) : '-' }}
            </el-descriptions-item>
          </el-descriptions>

          <div class="section-title">
            审核流水
          </div>
          <el-empty
            v-if="!detail.records || detail.records.length === 0"
            description="暂无流水记录"
            :image-size="70"
          />
          <el-timeline v-else>
            <el-timeline-item
              v-for="record in detail.records"
              :key="record.id"
              :timestamp="formatTime(record.created_at)"
              placement="top"
            >
              <div class="record-line">
                <StatusTag :text="record.action" />
                <span class="record-status">
                  {{ record.from_status ? claimStatusText(record.from_status) : '起点' }}
                  →
                  {{ claimStatusText(record.to_status) }}
                </span>
              </div>
              <div
                v-if="record.comment"
                class="record-comment"
              >
                {{ record.comment }}
              </div>
            </el-timeline-item>
          </el-timeline>
        </template>
      </div>
    </el-drawer>
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

.stat-card__value--primary {
  color: #409eff;
}

.stat-card__value--warning {
  color: #e6a23c;
}

.stat-card__value--danger {
  color: #f56c6c;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.drawer-body {
  min-height: 200px;
}

.section-title {
  margin: 18px 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.record-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.record-status {
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
