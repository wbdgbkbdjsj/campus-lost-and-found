<script setup lang="ts">
/**
 * C8 系统设置
 *
 * 契约里没有「系统参数读写」接口，业务规则（截止时间 +7 天、超时失效等）是后端硬编码的，
 * 前端改不了也不该假装能改。本页因此做成「规则说明 + 可执行运维动作」：
 *   - 展示状态机、错误码、截止时间等只读口径，答辩时可直接当规则页讲；
 *   - 提供真正能跑的运维动作：超时批处理（POST /review/expire-run）、认领单导出。
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AlarmClock, Download } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { runExpire } from '@/api/audit'
import { exportClaims } from '@/api/admin'
import {
  CLAIM_STATUS_LABEL,
  ERROR_CODE,
  ROLE_LABEL
} from '@/utils/constants'

const expiring = ref(false)
const exporting = ref(false)
const lastExpireResult = ref<{ expired: number; ids: number[]; at: string } | null>(null)

const roleRows = computed(() =>
  Object.entries(ROLE_LABEL).map(([code, label]) => ({
    code,
    label,
    scope:
      code === 'student'
        ? '大厅检索、发布、提交认领、查看本人单据'
        : code === 'reviewer'
          ? '审核队列、状态流转动作、交接登记'
          : '用户 / 字典 / 统计 / 日志 / 导出'
  }))
)

const errorRows = [
  { code: ERROR_CODE.ILLEGAL_TRANSITION, label: '非法状态迁移', desc: '当前状态不允许该动作' },
  { code: ERROR_CODE.FORBIDDEN, label: '越权访问', desc: '角色不具备该接口权限' },
  { code: ERROR_CODE.VALIDATION_ERROR, label: '校验失败', desc: '必填缺失或前置条件不满足（如未核验就交接）' },
  { code: ERROR_CODE.NOT_FOUND, label: '资源不存在', desc: '单据 / 物品 ID 无效' },
  { code: ERROR_CODE.UNAUTHORIZED, label: '未登录', desc: 'Token 缺失或过期，前端跳登录页' }
]

const ruleRows = [
  { rule: '审核通过后领取期限', value: '7 天（deadline = 通过时间 + 7d）' },
  { rule: '退回补充后补材料期限', value: '7 天（deadline = 退回时间 + 7d）' },
  { rule: '交接前置条件', value: '必须存在一条 VERIFY 通过的流水（不变量 I7）' },
  { rule: '同一物品可并行在途申请', value: '1 条（本人不可重复提交）' },
  { rule: '超时失效动作', value: 'PENDING_INFO / APPROVED → EXPIRED，由批处理触发' },
  { rule: '分页参数', value: 'page（从 1 开始）、size；返回 { total, items }' }
]

async function handleExpire() {
  try {
    await ElMessageBox.confirm(
      '将扫描所有超过 deadline 的「待补充材料」与「待领取」单据并置为「已失效」，操作不可撤销。继续吗？',
      '执行超时批处理',
      { type: 'warning', confirmButtonText: '执行', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  expiring.value = true
  try {
    const result = await runExpire()
    lastExpireResult.value = {
      expired: result.expired,
      ids: result.ids,
      at: new Date().toLocaleString('zh-CN')
    }
    if (result.expired > 0) {
      ElMessage.success(`已失效 ${result.expired} 条单据`)
    } else {
      ElMessage.info('没有超时单据，无需处理')
    }
  } finally {
    expiring.value = false
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
    ElMessage.success('导出完成')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="系统设置"
      description="业务规则口径与运维动作；参数由后端代码固化，前端不提供修改"
    />

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="只读说明"
      description="契约 v1 未提供系统参数的读写接口，截止天数、状态机等规则固化在后端 service 层。本页只做口径公示与可执行的运维动作。"
      style="margin-bottom: 12px"
    />

    <el-row :gutter="12">
      <el-col :span="12">
        <div class="page-card">
          <div class="card-title">
            运维动作
          </div>
          <div class="action-row">
            <el-button
              type="warning"
              :icon="AlarmClock"
              :loading="expiring"
              @click="handleExpire"
            >
              执行超时批处理
            </el-button>
            <span class="hint">对应 POST /review/expire-run</span>
          </div>
          <div class="action-row">
            <el-button
              type="primary"
              :icon="Download"
              :loading="exporting"
              @click="handleExport"
            >
              导出认领单 CSV
            </el-button>
            <span class="hint">对应 GET /admin/export/claims.csv</span>
          </div>

          <div
            v-if="lastExpireResult"
            class="result-box"
          >
            <div class="result-title">
              上次执行结果
            </div>
            <div class="result-line">
              执行时间：{{ lastExpireResult.at }}
            </div>
            <div class="result-line">
              失效条数：{{ lastExpireResult.expired }}
            </div>
            <div class="result-line">
              涉及单号：{{ lastExpireResult.ids.length ? lastExpireResult.ids.join(', ') : '无' }}
            </div>
          </div>

          <div class="section-title">
            状态字典
          </div>
          <div class="tag-wrap">
            <el-tag
              v-for="(label, code) in CLAIM_STATUS_LABEL"
              :key="code"
              type="info"
              effect="plain"
              size="small"
            >
              {{ code }} · {{ label }}
            </el-tag>
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="page-card">
          <div class="card-title">
            业务规则口径
          </div>
          <el-table
            :data="ruleRows"
            border
            size="small"
          >
            <el-table-column
              prop="rule"
              label="规则"
              width="190"
            />
            <el-table-column
              prop="value"
              label="取值"
              min-width="220"
            />
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :span="12">
        <div class="page-card">
          <div class="card-title">
            角色权限矩阵
          </div>
          <el-table
            :data="roleRows"
            border
            size="small"
          >
            <el-table-column
              prop="code"
              label="角色码"
              width="130"
            />
            <el-table-column
              prop="label"
              label="中文名"
              width="120"
            />
            <el-table-column
              prop="scope"
              label="可访问范围"
              min-width="220"
            />
          </el-table>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="page-card">
          <div class="card-title">
            错误码约定
          </div>
          <el-table
            :data="errorRows"
            border
            size="small"
          >
            <el-table-column
              prop="code"
              label="错误码"
              width="100"
            />
            <el-table-column
              prop="label"
              label="含义"
              width="130"
            />
            <el-table-column
              prop="desc"
              label="触发场景"
              min-width="220"
            />
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.card-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.result-box {
  padding: 12px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 14px;
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.result-line {
  font-size: 12px;
  line-height: 1.8;
  color: #606266;
}

.section-title {
  margin: 10px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
