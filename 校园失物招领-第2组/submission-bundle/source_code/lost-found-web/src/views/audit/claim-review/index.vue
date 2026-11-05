<script setup lang="ts">
/**
 * B3 认领审核（主从结构：左侧在途单列表，右侧单据处理面板）
 *
 * 状态机全部以后端 allowed_events 为准，页面不重写迁移规则：
 *   SUBMITTED  --ACCEPT-->  UNDER_REVIEW --APPROVE--> APPROVED --HANDOVER--> COMPLETED
 *                              |--REJECT--> REJECTED
 *                              |--REQUEST_INFO--> PENDING_INFO --SUPPLEMENT--> UNDER_REVIEW
 * 身份核验（#19 verify）是 APPROVED 上的自环动作，不改状态只写流水；
 * 交接前置条件是 VERIFY 已通过（不变量 I7），因此本页把「是否已核验」显式展示出来。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { getReviewQueue, approveClaim, rejectClaim, requestInfo, verifyClaim } from '@/api/audit'
import { getClaim } from '@/api/claim'
import type { ClaimDetail, ReviewQueueItem, VerifyPayload } from '@/types'
import { canDo, claimStatusText, claimTagType, formatTime } from '@/utils/status'
import { pushPendingHandover } from '@/utils/handover'

const queue = ref<ReviewQueueItem[]>([])
const queueLoading = ref(false)
const detailLoading = ref(false)
const detail = ref<ClaimDetail | null>(null)
const activeId = ref<number | null>(null)
const acting = ref(false)

/** 核验结果只在本页内存中保留，用于提示「已核验，可以交接」 */
const verifiedMap = ref<Record<number, boolean>>({})

const verifyVisible = ref(false)
const verifyFormRef = ref<FormInstance>()
const verifyForm = ref<VerifyPayload>({ student_no: '', name: '' })

const commentVisible = ref(false)
const commentMode = ref<'approve' | 'reject' | 'request-info'>('approve')
const commentText = ref('')

const verifyRules: FormRules = {
  student_no: [{ required: true, message: '请填写学号', trigger: 'blur' }],
  name: [{ required: true, message: '请填写姓名', trigger: 'blur' }]
}

const commentConfig = computed(() => {
  if (commentMode.value === 'reject') {
    return {
      title: '驳回认领申请',
      required: true,
      placeholder: '请说明驳回理由，例如：所述特征与实物不符',
      tip: '驳回后单据进入终态，申请人无法再次提交该物品的认领。'
    }
  }
  if (commentMode.value === 'request-info') {
    return {
      title: '退回补充材料',
      required: true,
      placeholder: '请说明需要补充哪些材料，例如：补充购买凭证或物品背面刻字细节',
      tip: '退回后单据转为「待补充材料」，截止时间顺延 7 天，申请人补齐后自动回到审核中。'
    }
  }
  return {
    title: '审核通过',
    required: false,
    placeholder: '可填写交接提示，例如：请携带学生证到 3 号楼值班室领取',
    tip: '通过后物品转为「待领取」，申请人需在 7 天内完成交接。'
  }
})

const isVerified = computed(() => {
  const id = detail.value?.id
  if (!id) return false
  if (verifiedMap.value[id]) return true
  const records = detail.value?.records ?? []
  return records.some((record) => record.action === 'VERIFY')
})

const actions = computed(() => {
  const events = detail.value?.allowed_events ?? []
  return {
    accept: canDo(events, 'ACCEPT'),
    verify: canDo(events, 'VERIFY'),
    approve: canDo(events, 'APPROVE'),
    reject: canDo(events, 'REJECT'),
    requestInfo: canDo(events, 'REQUEST_INFO'),
    handover: canDo(events, 'HANDOVER')
  }
})

async function loadQueue() {
  queueLoading.value = true
  try {
    const result = await getReviewQueue()
    queue.value = result.items
    if (!activeId.value && result.items.length > 0) {
      await selectClaim(result.items[0].id)
    }
  } finally {
    queueLoading.value = false
  }
}

async function selectClaim(id: number) {
  activeId.value = id
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getClaim(id)
  } finally {
    detailLoading.value = false
  }
}

/** 动作完成后刷新当前单与队列（单据可能已离开队列） */
async function afterAction(id: number) {
  const exists = queue.value.some((item) => item.id === id)
  await loadQueue()
  if (exists) {
    await selectClaim(id)
  } else {
    detail.value = null
    activeId.value = null
    await loadQueue()
  }
}

function openVerify() {
  verifyForm.value = { student_no: '', name: '' }
  verifyVisible.value = true
}

async function submitVerify() {
  if (!verifyFormRef.value || !detail.value) return
  const valid = await verifyFormRef.value.validate().catch(() => false)
  if (!valid) return
  acting.value = true
  try {
    const result = await verifyClaim(detail.value.id, {
      student_no: verifyForm.value.student_no.trim(),
      name: verifyForm.value.name.trim()
    })
    verifiedMap.value[detail.value.id] = result.verified
    if (result.verified) {
      ElMessage.success('核验通过，可以执行审核通过与交接')
      verifyVisible.value = false
    } else {
      ElMessage.error('核验不通过：学号与姓名和申请人不一致，请核对后再试')
    }
    await afterAction(detail.value.id)
  } finally {
    acting.value = false
  }
}

function openComment(mode: 'approve' | 'reject' | 'request-info') {
  commentMode.value = mode
  commentText.value = ''
  commentVisible.value = true
}

async function submitComment() {
  if (!detail.value) return
  const text = commentText.value.trim()
  if (commentConfig.value.required && text.length < 5) {
    ElMessage.warning('请至少填写 5 个字符的处理意见')
    return
  }
  acting.value = true
  try {
    if (commentMode.value === 'approve') {
      await approveClaim(detail.value.id, text)
      // 契约没有「待交接列表」接口，通过后把单号写入本地待交接缓存，供归还登记页取用
      pushPendingHandover(detail.value.id)
      ElMessage.success('审核已通过，物品转为「待领取」')
    } else if (commentMode.value === 'reject') {
      await rejectClaim(detail.value.id, text)
      ElMessage.success('已驳回该认领申请')
    } else {
      await requestInfo(detail.value.id, text)
      ElMessage.success('已退回补充，等待申请人补齐材料')
    }
    commentVisible.value = false
    await afterAction(detail.value.id)
  } finally {
    acting.value = false
  }
}

async function handleHandover() {
  if (!detail.value) return
  try {
    await ElMessageBox.confirm(
      isVerified.value
        ? `确认已完成 #${detail.value.id} 的实物交接？确认后物品转为「已认领」，单据进入「已完成」终态。`
        : '该单据尚未通过身份核验，后端会拒绝交接（不变量 I7）。请先做「身份核验」。',
      '确认交接',
      {
        type: isVerified.value ? 'success' : 'warning',
        confirmButtonText: isVerified.value ? '确认交接' : '仍然尝试',
        cancelButtonText: '取消'
      }
    )
  } catch {
    return
  }
  // 交接属于 B4 归还登记的职责，这里只做导航，避免两处写同一动作
  ElMessage.info('请到「归还登记」页完成交接确认，那里有完整的核验与交接流程')
}

onMounted(loadQueue)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="认领审核"
      description="按状态机推进单据：接单 → 身份核验 → 通过 / 驳回 / 退回补充"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="loadQueue"
        >
          刷新队列
        </el-button>
      </template>
    </PageHeader>

    <el-row :gutter="12">
      <el-col :span="8">
        <div
          v-loading="queueLoading"
          class="page-card queue-panel"
        >
          <div class="card-title">
            在途认领单（{{ queue.length }}）
          </div>
          <el-empty
            v-if="!queueLoading && queue.length === 0"
            description="没有待处理单据"
            :image-size="70"
          />
          <div
            v-for="item in queue"
            :key="item.id"
            class="queue-item"
            :class="{ 'queue-item--active': activeId === item.id }"
            @click="selectClaim(item.id)"
          >
            <div class="queue-item__head">
              <span class="queue-item__id">#{{ item.id }}</span>
              <StatusTag
                :text="claimStatusText(item.status)"
                :type="claimTagType(item.status)"
              />
            </div>
            <div class="queue-item__title">
              {{ item.title }}
            </div>
            <div class="queue-item__meta">
              申请人 {{ item.applicant }} · 等待 {{ item.waiting_minutes }} 分钟
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="16">
        <div
          v-loading="detailLoading"
          class="page-card detail-panel"
        >
          <EmptyState
            v-if="!detail"
            description="从左侧选择一张认领单开始审核"
          />
          <template v-else>
            <div class="detail-head">
              <div>
                <span class="detail-id">认领单 #{{ detail.id }}</span>
                <StatusTag
                  :text="claimStatusText(detail.status)"
                  :type="claimTagType(detail.status)"
                  class="detail-tag"
                />
                <el-tag
                  v-if="isVerified"
                  type="success"
                  size="small"
                  effect="dark"
                  class="detail-tag"
                >
                  已通过身份核验
                </el-tag>
                <el-tag
                  v-else
                  type="warning"
                  size="small"
                  effect="plain"
                  class="detail-tag"
                >
                  未核验
                </el-tag>
              </div>
              <div class="detail-actions">
                <el-button
                  v-if="actions.accept"
                  type="primary"
                  size="small"
                  @click="selectClaim(detail.id)"
                >
                  已接单
                </el-button>
                <el-button
                  v-if="actions.verify"
                  type="warning"
                  size="small"
                  @click="openVerify"
                >
                  身份核验
                </el-button>
                <el-button
                  v-if="actions.approve"
                  type="success"
                  size="small"
                  @click="openComment('approve')"
                >
                  审核通过
                </el-button>
                <el-button
                  v-if="actions.requestInfo"
                  size="small"
                  @click="openComment('request-info')"
                >
                  退回补充
                </el-button>
                <el-button
                  v-if="actions.reject"
                  type="danger"
                  size="small"
                  plain
                  @click="openComment('reject')"
                >
                  驳回
                </el-button>
                <el-button
                  v-if="actions.handover"
                  type="primary"
                  size="small"
                  @click="handleHandover"
                >
                  去交接
                </el-button>
              </div>
            </div>

            <el-descriptions
              :column="2"
              border
              size="small"
            >
              <el-descriptions-item label="物品编号">
                {{ detail.found_item_id }}
              </el-descriptions-item>
              <el-descriptions-item label="申请人 ID">
                {{ detail.applicant_id }}
              </el-descriptions-item>
              <el-descriptions-item label="接单审核员">
                {{ detail.reviewer_id ? `#${detail.reviewer_id}` : '未接单' }}
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
              <el-descriptions-item
                label="自证特征"
                :span="2"
              >
                {{ detail.proof }}
              </el-descriptions-item>
              <el-descriptions-item
                label="补充说明"
                :span="2"
              >
                {{ detail.description || '-' }}
              </el-descriptions-item>
              <el-descriptions-item
                label="当前可执行动作"
                :span="2"
              >
                <el-tag
                  v-for="event in detail.allowed_events"
                  :key="event"
                  size="small"
                  type="info"
                  effect="plain"
                  class="event-tag"
                >
                  {{ event }}
                </el-tag>
                <span v-if="detail.allowed_events.length === 0">无（终态）</span>
              </el-descriptions-item>
            </el-descriptions>

            <div class="section-title">
              审核流水
            </div>
            <el-empty
              v-if="!detail.records || detail.records.length === 0"
              description="暂无流水记录"
              :image-size="60"
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
      </el-col>
    </el-row>

    <el-dialog
      v-model="verifyVisible"
      title="身份核验"
      width="480px"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="核验口径"
        description="比对申请人自报的学号与姓名是否与系统账号一致。核验本身不改状态，只写一条 VERIFY 流水。"
        style="margin-bottom: 12px"
      />
      <el-form
        ref="verifyFormRef"
        :model="verifyForm"
        :rules="verifyRules"
        label-width="70px"
      >
        <el-form-item
          label="学号"
          prop="student_no"
        >
          <el-input
            v-model="verifyForm.student_no"
            placeholder="请输入申请人学号"
          />
        </el-form-item>
        <el-form-item
          label="姓名"
          prop="name"
        >
          <el-input
            v-model="verifyForm.name"
            placeholder="请输入申请人姓名"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="verifyVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="acting"
          @click="submitVerify"
        >
          提交核验
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="commentVisible"
      :title="commentConfig.title"
      width="520px"
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        :title="commentConfig.tip"
        style="margin-bottom: 12px"
      />
      <el-input
        v-model="commentText"
        type="textarea"
        :rows="4"
        maxlength="300"
        show-word-limit
        :placeholder="commentConfig.placeholder"
      />
      <template #footer>
        <el-button @click="commentVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="acting"
          @click="submitComment"
        >
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.queue-panel {
  min-height: 420px;
}

.detail-panel {
  min-height: 420px;
}

.card-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.queue-item {
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #c6e2ff;
  }
}

.queue-item--active {
  background: #ecf5ff;
  border-color: #409eff;
}

.queue-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.queue-item__id {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.queue-item__title {
  margin-top: 6px;
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-id {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.detail-tag {
  margin-left: 8px;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.event-tag {
  margin-right: 6px;
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
