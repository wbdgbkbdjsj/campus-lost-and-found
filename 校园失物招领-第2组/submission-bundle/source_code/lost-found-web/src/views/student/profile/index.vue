<script setup lang="ts">
/**
 * A8 个人中心（学生端）
 *
 * 数据源：GET /auth/me 拉最新账号信息，GET /claims?scope=mine 统计我的认领情况，
 * GET /notifications 统计未读条数。
 * 契约 v1 没有「修改资料 / 改密码」接口，所以本页是只读的，页面里如实写明。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { getProfile } from '@/api/auth'
import { pageMyClaims } from '@/api/claim'
import { getNotifications } from '@/api/notice'
import { useAuthStore } from '@/stores/auth'
import type { Claim, LoginUser } from '@/types'
import { CLAIM_TERMINAL_STATUS, ROLE_LABEL } from '@/utils/constants'
import { formatTime } from '@/utils/status'

const router = useRouter()
const auth = useAuthStore()

const profile = ref<LoginUser | null>(auth.user)
const claims = ref<Claim[]>([])
const unread = ref(0)
const loading = ref(false)

const initial = computed(() => (profile.value?.name || '?').slice(0, 1))

const stats = computed(() => {
  const bucket = { total: claims.value.length, active: 0, completed: 0, failed: 0 }
  claims.value.forEach((item) => {
    if (item.status === 'COMPLETED') bucket.completed += 1
    else if (CLAIM_TERMINAL_STATUS.includes(item.status)) bucket.failed += 1
    else bucket.active += 1
  })
  return bucket
})

/** 最近三条申请，作为「我最近在忙什么」的概览 */
const recentClaims = computed(() =>
  [...claims.value]
    .sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''))
    .slice(0, 3)
)

async function load() {
  loading.value = true
  try {
    const [me, claimResult, noticeResult] = await Promise.all([
      getProfile(),
      pageMyClaims(),
      getNotifications()
    ])
    profile.value = me
    claims.value = claimResult.items
    unread.value = noticeResult.items.filter((item) => !item.is_read).length
  } finally {
    loading.value = false
  }
}

async function logout() {
  try {
    await ElMessageBox.confirm('退出后需要重新用学号登录，确定退出吗？', '退出登录', {
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
      description="账号信息与我的使用概况"
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
            type="success"
            size="small"
            effect="plain"
          >
            {{ ROLE_LABEL[profile?.role ?? ''] || profile?.role || '-' }}
          </el-tag>
          <div class="profile-no">
            学号 {{ profile?.student_no || '-' }}
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
            <el-descriptions-item label="学号">
              {{ profile?.student_no || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="角色">
              {{ ROLE_LABEL[profile?.role ?? ''] || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="登录态">
              {{ auth.isLogin ? '已登录' : '未登录' }}
            </el-descriptions-item>
            <el-descriptions-item label="未读通知">
              {{ unread }} 条
            </el-descriptions-item>
          </el-descriptions>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="资料修改说明"
            description="契约 v1 未提供修改姓名 / 手机号 / 密码的接口，如需变更请联系系统管理员在后台处理。"
            style="margin-top: 12px"
          />
        </div>
      </el-col>
    </el-row>

    <div class="page-card">
      <div class="card-title">
        我的认领概况
      </div>
      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-card__label">
            申请总数
          </div>
          <div class="stat-card__value">
            {{ stats.total }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">
            进行中
          </div>
          <div class="stat-card__value stat-card__value--warning">
            {{ stats.active }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">
            已完成
          </div>
          <div class="stat-card__value stat-card__value--success">
            {{ stats.completed }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">
            未成功
          </div>
          <div class="stat-card__value stat-card__value--muted">
            {{ stats.failed }}
          </div>
        </div>
      </div>

      <div class="section-title">
        最近申请
      </div>
      <el-table
        :data="recentClaims"
        border
        size="small"
        empty-text="暂无认领申请"
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
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          prop="status_text"
          label="状态"
          width="150"
        />
        <el-table-column
          label="提交时间"
          width="150"
        >
          <template #default="{ row }">
            {{ formatTime(row.submitted_at) }}
          </template>
        </el-table-column>
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
  background: #409eff;
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
  margin-bottom: 16px;
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

.stat-card__value--warning {
  color: #e6a23c;
}

.stat-card__value--success {
  color: #67c23a;
}

.stat-card__value--muted {
  color: #909399;
}

.section-title {
  margin: 4px 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
</style>
