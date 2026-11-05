<script setup lang="ts">
/**
 * B5 审核记录（认领单流水追溯）
 *
 * 契约 v1 没有「审核流水列表」接口——流水是 GET /claims/{id} 返回体里的 records 字段，
 * 属于单张单据的从属数据。所以本页按「选单 → 看流水」组织：
 *   1) 从审核队列里挑在途单；
 *   2) 从本地待交接缓存里挑已通过的单；
 *   3) 也可以直接输入单号调取。
 * 页面把流水按动作聚合出统计，便于答辩时展示状态机确实跑过每一跳。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { getReviewQueue } from '@/api/audit'
import { getClaim } from '@/api/claim'
import type { ClaimDetail, ReviewQueueItem } from '@/types'
import { CLAIM_ACTION_LABEL } from '@/utils/constants'
import { claimStatusText, claimTagType, formatTime } from '@/utils/status'
import { listPendingHandover } from '@/utils/handover'

const claimIdInput = ref('')
const detail = ref<ClaimDetail | null>(null)
const loading = ref(false)
const queue = ref<ReviewQueueItem[]>([])
const queueLoading = ref(false)
const pendingIds = ref<number[]>([])
const actionFilter = ref('')

const records = computed(() => detail.value?.records ?? [])

const visibleRecords = computed(() =>
  actionFilter.value ? records.value.filter((one) => one.action === actionFilter.value) : records.value
)

/** 出现过的动作，做成筛选下拉 */
const actionOptions = computed(() => {
  const set = new Set(records.value.map((one) => one.action))
  return Array.from(set)
})

/** 按动作计数，答辩时一眼看出状态机跳了几步 */
const actionCount = computed(() => {
  const map: Record<string, number> = {}
  records.value.forEach((one) => {
    map[one.action] = (map[one.action] ?? 0) + 1
  })
  return map
})

/** 首末流水时间差，近似单据处理时长 */
const durationText = computed(() => {
  if (records.value.length < 2) return '-'
  const first = records.value[0]?.created_at
  const last = records.value[records.value.length - 1]?.created_at
  if (!first || !last) return '-'
  const diff = new Date(last).getTime() - new Date(first).getTime()
  if (Number.isNaN(diff) || diff < 0) return '-'
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时 ${minutes % 60} 分`
})

function actionLabel(action: string) {
  return CLAIM_ACTION_LABEL[action] ?? action
}

async function fetchClaim(id: number) {
  if (!Number.isFinite(id) || id <= 0) {
    ElMessage.warning('请输入有效的认领单号')
    return
  }
  loading.value = true
  actionFilter.value = ''
  try {
    detail.value = await getClaim(id)
    claimIdInput.value = String(id)
    if (records.value.length === 0) {
      ElMessage.info(`#${id} 暂无流水记录`)
    }
  } finally {
    loading.value = false
  }
}

function loadFromInput() {
  fetchClaim(Number(claimIdInput.value))
}

async function loadQueue() {
  queueLoading.value = true
  try {
    const result = await getReviewQueue()
    queue.value = result.items.slice(0, 8)
  } finally {
    queueLoading.value = false
  }
}

async function refreshAll() {
  await loadQueue()
  pendingIds.value = listPendingHandover()
}

onMounted(refreshAll)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="审核记录"
      description="按认领单追溯完整审核流水，核对每一次状态迁移"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="refreshAll"
        >
          刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="claimIdInput"
          placeholder="输入认领单号"
          style="width: 200px"
          :prefix-icon="Search"
          @keyup.enter="loadFromInput"
        />
        <el-button
          type="primary"
          :loading="loading"
          @click="loadFromInput"
        >
          查询流水
        </el-button>
        <el-divider direction="vertical" />
        <span class="hint">在途单：</span>
        <el-tag
          v-for="item in queue"
          :key="item.id"
          size="small"
          effect="plain"
          class="pick-tag"
          @click="fetchClaim(item.id)"
        >
          #{{ item.id }}
        </el-tag>
        <span
          v-if="queue.length === 0"
          class="hint"
        >队列为空</span>
      </div>

      <div class="toolbar">
        <span class="hint">待交接：</span>
        <el-tag
          v-for="id in pendingIds"
          :key="id"
          size="small"
          type="success"
          effect="plain"
          class="pick-tag"
          @click="fetchClaim(id)"
        >
          #{{ id }}
        </el-tag>
        <span
          v-if="pendingIds.length === 0"
          class="hint"
        >暂无</span>
      </div>
    </div>

    <div
      v-loading="loading"
      class="page-card"
      style="margin-top: 12px"
    >
      <EmptyState
        v-if="!detail"
        description="尚未选择认领单，请在上方选择或输入单号"
      />
      <template v-else>
        <div class="head">
          <div>
            <span class="head-id">认领单 #{{ detail.id }}</span>
            <StatusTag
              :text="claimStatusText(detail.status)"
              :type="claimTagType(detail.status)"
              class="head-tag"
            />
          </div>
          <el-select
            v-model="actionFilter"
            placeholder="全部动作"
            clearable
            size="small"
            style="width: 150px"
          >
            <el-option
              v-for="action in actionOptions"
              :key="action"
              :label="actionLabel(action)"
              :value="action"
            />
          </el-select>
        </div>

        <div class="stat-row">
          <div class="stat-card">
            <div class="stat-card__label">
              流水条数
            </div>
            <div class="stat-card__value">
              {{ records.length }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">
              涉及动作
            </div>
            <div class="stat-card__value">
              {{ actionOptions.length }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">
              处理时长
            </div>
            <div class="stat-card__value stat-card__value--small">
              {{ durationText }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">
              申请人 / 物品
            </div>
            <div class="stat-card__value stat-card__value--small">
              #{{ detail.applicant_id }} / #{{ detail.found_item_id }}
            </div>
          </div>
        </div>

        <el-table
          :data="visibleRecords"
          border
          stripe
          size="small"
        >
          <el-table-column
            prop="id"
            label="流水号"
            width="90"
          />
          <el-table-column
            label="动作"
            width="150"
          >
            <template #default="{ row }">
              <StatusTag :text="actionLabel(row.action)" />
            </template>
          </el-table-column>
          <el-table-column
            label="状态迁移"
            min-width="220"
          >
            <template #default="{ row }">
              {{ row.from_status ? claimStatusText(row.from_status) : '起点' }}
              →
              {{ claimStatusText(row.to_status) }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作人"
            width="110"
          >
            <template #default="{ row }">
              {{ row.reviewer_id ? `#${row.reviewer_id}` : '系统' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="comment"
            label="意见"
            min-width="220"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.comment || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            label="时间"
            width="160"
          >
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>

          <template #empty>
            <EmptyState description="该筛选条件下没有流水" />
          </template>
        </el-table>

        <div class="section-title">
          各动作出现次数
        </div>
        <div class="count-row">
          <el-tag
            v-for="(count, action) in actionCount"
            :key="action"
            type="info"
            effect="plain"
          >
            {{ actionLabel(String(action)) }} × {{ count }}
          </el-tag>
          <span
            v-if="Object.keys(actionCount).length === 0"
            class="hint"
          >暂无</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}

.hint {
  font-size: 12px;
  color: #909399;
}

.pick-tag {
  cursor: pointer;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.head-id {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.head-tag {
  margin-left: 8px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stat-card {
  padding: 12px 14px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.stat-card__label {
  font-size: 12px;
  color: #909399;
}

.stat-card__value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

.stat-card__value--small {
  font-size: 15px;
}

.section-title {
  margin: 16px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.count-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
