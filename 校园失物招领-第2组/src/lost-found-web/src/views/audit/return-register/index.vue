<script setup lang="ts">
/**
 * B4 归还登记（交接确认）
 *
 * 交接 = APPROVED → COMPLETED，后端有两个前置条件：
 *   1) 单据处于 APPROVED 且 allowed_events 含 HANDOVER；
 *   2) 已存在一条核验通过（VERIFY）的流水——不变量 I7，否则返回 40003。
 * 因此本页把「核验」与「交接」串成一步式流程，未核验时交接按钮不可点。
 *
 * 数据来源：契约没有「待交接列表」接口，单号由手动输入或从审核通过时的本地缓存带入。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { handoverClaim, verifyClaim } from '@/api/audit'
import { getClaim } from '@/api/claim'
import type { ClaimDetail, VerifyPayload } from '@/types'
import { canDo, claimStatusText, claimTagType, formatTime } from '@/utils/status'
import { listPendingHandover, removePendingHandover } from '@/utils/handover'

const claimIdInput = ref('')
const detail = ref<ClaimDetail | null>(null)
const loading = ref(false)
const verified = ref(false)
const acting = ref(false)
const pendingIds = ref<number[]>([])

const verifyFormRef = ref<FormInstance>()
const verifyForm = ref<VerifyPayload>({ student_no: '', name: '' })
const handoverRemark = ref('')

const verifyRules: FormRules = {
  student_no: [{ required: true, message: '请填写学号', trigger: 'blur' }],
  name: [{ required: true, message: '请填写姓名', trigger: 'blur' }]
}

const canHandover = computed(() => {
  if (!detail.value) return false
  return canDo(detail.value.allowed_events, 'HANDOVER')
})

/** 流水里已经有 VERIFY 记录时，回填核验状态 */
const verifiedFromRecords = computed(() =>
  (detail.value?.records ?? []).some((record) => record.action === 'VERIFY')
)

async function fetchClaim(id: number) {
  if (!Number.isFinite(id) || id <= 0) {
    ElMessage.warning('请输入有效的认领单号')
    return
  }
  loading.value = true
  verified.value = false
  handoverRemark.value = ''
  try {
    detail.value = await getClaim(id)
    verified.value = verifiedFromRecords.value
    if (detail.value.status !== 'APPROVED') {
      ElMessage.warning(
        `该单当前状态为「${claimStatusText(detail.value.status)}」，只有「审核通过·待领取」的单据可以交接`
      )
    }
  } finally {
    loading.value = false
  }
}

function loadFromInput() {
  fetchClaim(Number(claimIdInput.value))
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
    verified.value = result.verified
    if (result.verified) {
      ElMessage.success('核验通过，现在可以确认交接')
    } else {
      ElMessage.error('核验不通过：学号与姓名和申请人不一致')
    }
    await fetchClaim(detail.value.id)
  } finally {
    acting.value = false
  }
}

async function submitHandover() {
  if (!detail.value) return
  acting.value = true
  try {
    await handoverClaim(detail.value.id, {
      comment: handoverRemark.value.trim() || '实物已当面交接'
    })
    ElMessage.success(`#${detail.value.id} 交接完成，物品状态已转为「已认领」`)
    removePendingHandover(detail.value.id)
    refreshPendingList()
    await fetchClaim(detail.value.id)
  } finally {
    acting.value = false
  }
}

function refreshPendingList() {
  pendingIds.value = listPendingHandover()
}

onMounted(async () => {
  refreshPendingList()
  if (pendingIds.value.length > 0) {
    claimIdInput.value = String(pendingIds.value[0])
    await fetchClaim(pendingIds.value[0])
  }
})
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="归还登记"
      description="核对领件人身份后确认交接，交接完成即闭环"
    />

    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="claimIdInput"
          placeholder="输入认领单号，例如：3"
          style="width: 220px"
          :prefix-icon="Search"
          @keyup.enter="loadFromInput"
        />
        <el-button
          type="primary"
          :loading="loading"
          @click="loadFromInput"
        >
          调取单据
        </el-button>
        <el-divider direction="vertical" />
        <span class="hint">待交接缓存：</span>
        <el-tag
          v-for="id in pendingIds"
          :key="id"
          size="small"
          effect="plain"
          class="pending-tag"
          @click="fetchClaim(id)"
        >
          #{{ id }}
        </el-tag>
        <span
          v-if="pendingIds.length === 0"
          class="hint"
        >暂无（审核通过后自动登记）</span>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="为什么需要手输单号"
        description="契约 v1 未提供「待交接认领单列表」查询接口，审核通过的单据会登记到本地缓存，也可直接输入单号调取。"
      />
    </div>

    <div
      v-loading="loading"
      class="page-card"
      style="margin-top: 12px"
    >
      <EmptyState
        v-if="!detail"
        description="尚未调取单据，请在上方输入认领单号"
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
              :type="verified ? 'success' : 'warning'"
              size="small"
              :effect="verified ? 'dark' : 'plain'"
              class="detail-tag"
            >
              {{ verified ? '核验已通过' : '尚未核验' }}
            </el-tag>
          </div>
          <div class="detail-meta">
            物品 #{{ detail.found_item_id }} · 提交 {{ formatTime(detail.submitted_at) }}
          </div>
        </div>

        <el-row :gutter="12">
          <el-col :span="12">
            <div class="sub-title">
              单据信息
            </div>
            <el-descriptions
              :column="1"
              border
              size="small"
            >
              <el-descriptions-item label="申请人 ID">
                {{ detail.applicant_id }}
              </el-descriptions-item>
              <el-descriptions-item label="联系方式">
                {{ detail.contact || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="自证特征">
                {{ detail.proof }}
              </el-descriptions-item>
              <el-descriptions-item label="截止时间">
                {{ detail.deadline ? formatTime(detail.deadline) : '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="可执行动作">
                <el-tag
                  v-for="event in detail.allowed_events"
                  :key="event"
                  size="small"
                  type="info"
                  effect="plain"
                  class="pending-tag"
                >
                  {{ event }}
                </el-tag>
                <span v-if="detail.allowed_events.length === 0">无（终态）</span>
              </el-descriptions-item>
            </el-descriptions>
          </el-col>

          <el-col :span="12">
            <div class="sub-title">
              领件人核验
            </div>
            <el-form
              ref="verifyFormRef"
              :model="verifyForm"
              :rules="verifyRules"
              label-width="70px"
              size="small"
            >
              <el-form-item
                label="学号"
                prop="student_no"
              >
                <el-input
                  v-model="verifyForm.student_no"
                  placeholder="领件人学号"
                />
              </el-form-item>
              <el-form-item
                label="姓名"
                prop="name"
              >
                <el-input
                  v-model="verifyForm.name"
                  placeholder="领件人姓名"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="warning"
                  :loading="acting"
                  @click="submitVerify"
                >
                  执行核验
                </el-button>
              </el-form-item>
            </el-form>

            <div class="sub-title">
              交接备注
            </div>
            <el-input
              v-model="handoverRemark"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="例如：学生携带学生证到 3 号楼值班室当面领取"
            />
            <div class="handover-row">
              <el-button
                type="primary"
                :loading="acting"
                :disabled="!canHandover || !verified"
                @click="submitHandover"
              >
                确认交接完成
              </el-button>
              <span
                v-if="!verified"
                class="hint"
              >需先通过身份核验才能交接（不变量 I7）</span>
              <span
                v-else-if="!canHandover"
                class="hint"
              >当前状态不允许交接</span>
            </div>
          </el-col>
        </el-row>

        <div class="sub-title">
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
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.pending-tag {
  margin-right: 6px;
  cursor: pointer;
}

.detail-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
}

.detail-id {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.detail-tag {
  margin-left: 8px;
}

.detail-meta {
  font-size: 12px;
  color: #909399;
}

.sub-title {
  margin: 10px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.handover-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
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
