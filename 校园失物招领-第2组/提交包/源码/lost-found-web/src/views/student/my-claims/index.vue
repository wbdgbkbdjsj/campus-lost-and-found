<script setup lang="ts">
/**
 * A6 我的申请（认领单列表 + 详情抽屉 + 撤销 / 补充材料）
 *
 * GET /claims?scope=mine 只返回本人单子，契约里没有分页参数，一次给全量。
 * 状态筛选放本地，不做假的「服务端筛选」。
 * 撤销走 POST /review/claims/{id}/cancel（契约 #16），补充材料走 POST /claims/{id}/supplement。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { cancelClaim, getClaim, pageMyClaims, supplementClaim } from '@/api/claim'
import {
  CLAIM_ACTION,
  CLAIM_STATUS_LABEL,
  CLAIM_TERMINAL_STATUS
} from '@/utils/constants'
import type { Claim, ClaimDetail } from '@/types'
import { canDo, claimStatusText, claimTagType, formatTime } from '@/utils/status'

const list = ref<Claim[]>([])
const loading = ref(false)
const statusFilter = ref('')
const keyword = ref('')

const drawerVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<ClaimDetail | null>(null)

const supplementVisible = ref(false)
const supplementText = ref('')
const supplementSubmitting = ref(false)
const activeClaimId = ref<number | null>(null)

/** 终态单子占多数，单独给一个「只看进行中」的开关，比下拉更好点 */
const onlyActive = ref(false)

const statusOptions = computed(() =>
  Object.entries(CLAIM_STATUS_LABEL).map(([value, label]) => ({ value, label }))
)

const filteredList = computed(() =>
  list.value.filter((item) => {
    if (onlyActive.value && CLAIM_TERMINAL_STATUS.includes(item.status)) return false
    if (statusFilter.value && item.status !== statusFilter.value) return false
    if (keyword.value) {
      const text = `${item.id} ${item.description || ''} ${item.proof || ''}`
      if (!text.includes(keyword.value.trim())) return false
    }
    return true
  })
)

const summary = computed(() => {
  const bucket = { active: 0, pending: 0, done: 0, failed: 0 }
  list.value.forEach((item) => {
    if (CLAIM_TERMINAL_STATUS.includes(item.status)) {
      if (item.status === 'COMPLETED') bucket.done += 1
      else bucket.failed += 1
    } else {
      bucket.active += 1
      if (item.status === 'PENDING_INFO') bucket.pending += 1
    }
  })
  return bucket
})

async function load() {
  loading.value = true
  try {
    const result = await pageMyClaims()
    list.value = result.items
  } finally {
    loading.value = false
  }
}

async function openDetail(row: Claim) {
  drawerVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getClaim(row.id)
  } finally {
    detailLoading.value = false
  }
}

async function reloadDetail(id: number) {
  detail.value = await getClaim(id)
  await load()
}

async function handleCancel(row: Claim) {
  try {
    await ElMessageBox.confirm(
      `撤销后认领单 #${row.id} 将进入「已撤销」终态，无法恢复。确定撤销吗？`,
      '撤销认领申请',
      { type: 'warning', confirmButtonText: '确定撤销', cancelButtonText: '再想想' }
    )
  } catch {
    return
  }
  await cancelClaim(row.id, '申请人主动撤销')
  ElMessage.success('认领申请已撤销')
  if (drawerVisible.value && detail.value?.id === row.id) {
    await reloadDetail(row.id)
  } else {
    await load()
  }
}

function openSupplement(row: Claim) {
  activeClaimId.value = row.id
  supplementText.value = ''
  supplementVisible.value = true
}

async function submitSupplement() {
  if (!activeClaimId.value) return
  const text = supplementText.value.trim()
  if (text.length < 5) {
    ElMessage.warning('请至少填写 5 个字符的补充说明')
    return
  }
  supplementSubmitting.value = true
  try {
    await supplementClaim(activeClaimId.value, text)
    ElMessage.success('材料已补充，认领单重新进入审核流程')
    supplementVisible.value = false
    if (drawerVisible.value && detail.value?.id === activeClaimId.value) {
      await reloadDetail(activeClaimId.value)
    } else {
      await load()
    }
  } finally {
    supplementSubmitting.value = false
  }
}

/** 流水时间线节点的颜色：成功/驳回/进行中区分开 */
function recordTagType(action: string) {
  if (action === 'APPROVE' || action === 'HANDOVER') return 'success'
  if (action === 'REJECT' || action === 'EXPIRE') return 'danger'
  if (action === 'REQUEST_INFO') return 'warning'
  return 'primary'
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="我的申请"
      description="跟踪每份认领单的审核进度，待补充材料时在此补齐"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="load"
        >
          刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-card__label">
          进行中
        </div>
        <div class="stat-card__value">
          {{ summary.active }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          待我补充
        </div>
        <div class="stat-card__value stat-card__value--warning">
          {{ summary.pending }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          已完成
        </div>
        <div class="stat-card__value stat-card__value--success">
          {{ summary.done }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          未成功
        </div>
        <div class="stat-card__value stat-card__value--muted">
          {{ summary.failed }}
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="搜单号 / 描述 / 证明材料"
          clearable
          style="width: 240px"
        />
        <el-select
          v-model="statusFilter"
          placeholder="全部状态"
          clearable
          style="width: 170px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-switch
          v-model="onlyActive"
          active-text="只看进行中"
          inline-prompt
        />
        <span class="hint">状态与关键词均为本地筛选</span>
      </div>

      <el-table
        v-loading="loading"
        :data="filteredList"
        border
        stripe
      >
        <el-table-column
          prop="id"
          label="单号"
          width="90"
        />
        <el-table-column
          prop="found_item_id"
          label="物品编号"
          width="110"
        />
        <el-table-column
          prop="proof"
          label="自证特征"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          label="状态"
          width="140"
        >
          <template #default="{ row }">
            <StatusTag
              :text="claimStatusText(row.status)"
              :type="claimTagType(row.status)"
            />
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
          label="截止时间"
          width="150"
        >
          <template #default="{ row }">
            {{ row.deadline ? formatTime(row.deadline) : '-' }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="200"
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
              v-if="canDo(row.allowed_events, CLAIM_ACTION.RESUBMIT)"
              link
              type="warning"
              @click="openSupplement(row)"
            >
              补充材料
            </el-button>
            <el-button
              v-if="canDo(row.allowed_events, CLAIM_ACTION.CANCEL)"
              link
              type="danger"
              @click="handleCancel(row)"
            >
              撤销
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <EmptyState description="还没有提交过认领申请">
            <template #action>
              <el-button
                type="primary"
                @click="$router.push('/student/home')"
              >
                去大厅找找
              </el-button>
            </template>
          </EmptyState>
        </template>
      </el-table>
    </div>

    <el-drawer
      v-model="drawerVisible"
      title="认领单详情"
      size="560px"
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
            <el-descriptions-item label="当前状态">
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
            <el-descriptions-item label="接单审核员">
              {{ detail.reviewer_id ? `#${detail.reviewer_id}` : '尚未接单' }}
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
              :type="recordTagType(record.action)"
            >
              <div class="record-line">
                <StatusTag
                  :text="record.action"
                  :type="recordTagType(record.action)"
                />
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

    <el-dialog
      v-model="supplementVisible"
      title="补充材料"
      width="520px"
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="补充后认领单会重新进入审核队列"
        description="请针对审核员退回补充的意见逐条回应，材料越具体越容易通过。"
        style="margin-bottom: 12px"
      />
      <el-input
        v-model="supplementText"
        type="textarea"
        :rows="5"
        maxlength="300"
        show-word-limit
        placeholder="例如：补充说明伞柄划痕位置在握把下方 3cm，并附上购买凭证编号"
      />
      <template #footer>
        <el-button @click="supplementVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="supplementSubmitting"
          @click="submitSupplement"
        >
          提交补充
        </el-button>
      </template>
    </el-dialog>
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

.stat-card__value--warning {
  color: #e6a23c;
}

.stat-card__value--success {
  color: #67c23a;
}

.stat-card__value--muted {
  color: #909399;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
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
