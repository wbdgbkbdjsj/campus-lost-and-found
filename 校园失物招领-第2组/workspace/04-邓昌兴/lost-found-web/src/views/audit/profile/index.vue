<script setup lang="ts">
/**
 * B6 个人中心（审核端）
 *
 * 审核员可用的接口只有 /auth/me 与 /review/queue（/admin/stats 是 super_admin 专属，
 * 审核员调用会返回 40002），所以本页的「工作量」指标全部由队列现场计算，
 * 不借用后台统计接口，避免越权调用。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { getProfile } from '@/api/auth'
import { getReviewQueue } from '@/api/audit'
import { useAuthStore } from '@/stores/auth'
import type { LoginUser, ReviewQueueItem } from '@/types'
import { ROLE_LABEL } from '@/utils/constants'
import { listPendingHandover } from '@/utils/handover'

const router = useRouter()
const auth = useAuthStore()

const profile = ref<LoginUser | null>(auth.user)
const queue = ref<ReviewQueueItem[]>([])
const pendingHandover = ref<number[]>([])
const loading = ref(false)

const initial = computed(() => (profile.value?.name || '?').slice(0, 1))

const workload = computed(() => {
  const bucket = { total: queue.value.length, mine: 0, submitted: 0, pendingInfo: 0, slow: 0 }
  queue.value.forEach((item) => {
    if (item.reviewer_id && item.reviewer_id === profile.value?.id) bucket.mine += 1
    if (item.status === 'SUBMITTED') bucket.submitted += 1
    if (item.status === 'PENDING_INFO') bucket.pendingInfo += 1
    if (item.waiting_minutes >= 120) bucket.slow += 1
  })
  return bucket
})

/** 队列里最长等待，用来提示是否需要加班处理 */
const oldest = computed(() =>
  queue.value.reduce((max, item) => Math.max(max, item.waiting_minutes), 0)
)

async function load() {
  loading.value = true
  try {
    const [me, queueResult] = await Promise.all([getProfile(), getReviewQueue()])
    profile.value = me
    queue.value = queueResult.items
    pendingHandover.value = listPendingHandover()
  } finally {
    loading.value = false
  }
}

async function logout() {
  try {
    await ElMessageBox.confirm('退出后需要重新登录，确定退出吗？', '退出登录', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  auth.logout()
  ElMessage.success('已退出登录')
  router.replace('/login')
}

onMounted(load)
</script>

<template>
  <div
    v-loading="loading"
    class="page-container"
  >
    <PageHeader
      title="个人中心"
      description="审核员账号信息与当前工作量"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="load"
        >
          刷新
        </el-button>
        <el-button
          type="danger"
          plain
          @click="logout"
        >
          退出登录
        </el-button>
      </template>
    </PageHeader>

    <el-row :gutter="12">
      <el-col :span="8">
        <div class="page-card profile-card">
          <el-avatar
            :size="64"
            class="profile-avatar"
          >
            {{ initial }}
          </el-avatar>
          <div class="profile-name">
            {{ profile?.name || '未命名' }}
          </div>
          <el-tag
            type="warning"
            size="small"
            effect="plain"
          >
            {{ ROLE_LABEL[profile?.role ?? ''] || profile?.role || '-' }}
          </el-tag>
          <div class="profile-no">
            工号/学号 {{ profile?.student_no || '-' }}
          </div>
        </div>
      </el-col>

      <el-col :span="16">
        <div class="page-card">
          <div class="card-title">
            账号信息
          </div>
          <el-descriptions
            :column="2"
            border
            size="small"
          >
            <el-descriptions-item label="用户 ID">
              {{ profile?.id ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="姓名">
              {{ profile?.name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="账号">
              {{ profile?.student_no || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="角色">
              {{ ROLE_LABEL[profile?.role ?? ''] || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="登录态">
              {{ auth.isLogin ? '已登录' : '未登录' }}
            </el-descriptions-item>
            <el-descriptions-item label="本地待交接">
              {{ pendingHandover.length }} 单
            </el-descriptions-item>
          </el-descriptions>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="权限说明"
            description="审核员可访问审核队列与状态流动作；用户管理、字典维护、统计看板属于超级管理员权限，审核员访问会返回 40002。"
            style="margin-top: 12px"
          />
        </div>
      </el-col>
    </el-row>

    <div class="page-card">
      <div class="card-title">
        当前工作量
      </div>
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-card__label">
            队列总量
          </div>
          <div class="stat-card__value">
            {{ workload.total }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">
            我接的单
          </div>
          <div class="stat-card__value stat-card__value--primary">
            {{ workload.mine }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">
            待接单
          </div>
          <div class="stat-card__value stat-card__value--warning">
            {{ workload.submitted }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">
            超 120 分钟
          </div>
          <div class="stat-card__value stat-card__value--danger">
            {{ workload.slow }}
          </div>
        </div>
      </div>

      <el-alert
        v-if="oldest >= 120"
        type="warning"
        :closable="false"
        show-icon
        :title="`队列中最长等待已达 ${oldest} 分钟，建议优先处理`"
        description="超过 2 小时未接单会影响平均审核时长指标，可到「审核工作台」按等待时长排序处理。"
      />
      <el-alert
        v-else-if="workload.total === 0"
        type="success"
        :closable="false"
        show-icon
        title="队列已清空"
        description="当前没有待处理认领单，可到「审核记录」查看历史流水。"
      />

      <div class="section-title">
        我接单的明细
      </div>
      <el-table
        :data="queue.filter((item) => item.reviewer_id === profile?.id)"
        border
        size="small"
        empty-text="暂无由我接单的在途单据"
      >
        <el-table-column
          prop="id"
          label="单号"
          width="90"
        />
        <el-table-column
          prop="title"
          label="物品"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="applicant"
          label="申请人"
          width="140"
        />
        <el-table-column
          prop="status_text"
          label="状态"
          width="140"
        />
        <el-table-column
          prop="waiting_minutes"
          label="已等待（分钟）"
          width="140"
        />
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
}

.profile-avatar {
  background: #e6a23c;
  font-size: 24px;
}

.profile-name {
  margin: 12px 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.profile-no {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.card-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
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
  font-size: 13px;
  color: #909399;
}

.stat-card__value {
  margin-top: 6px;
  font-size: 22px;
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

.section-title {
  margin: 16px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
</style>
