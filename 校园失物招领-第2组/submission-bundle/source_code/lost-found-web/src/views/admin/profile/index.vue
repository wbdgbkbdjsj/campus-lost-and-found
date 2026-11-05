<script setup lang="ts">
/**
 * C9 个人中心（后台）
 *
 * 管理员可访问 /auth/me 与 /admin/stats/overview，
 * 因此本页在账号信息之外，再展示一份全站运行摘要，作为管理员登录后的自检视图。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { getProfile } from '@/api/auth'
import { getStatsOverview } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import type { LoginUser, StatsOverview } from '@/types'
import { ROLE_LABEL } from '@/utils/constants'

const router = useRouter()
const auth = useAuthStore()

const profile = ref<LoginUser | null>(auth.user)
const stats = ref<StatsOverview | null>(null)
const loading = ref(false)

const initial = computed(() => (profile.value?.name || '?').slice(0, 1))

const healthRows = computed(() => {
  const data = stats.value
  if (!data) return []
  return [
    { label: '注册用户', value: data.users.total, tip: `停用 ${data.users.disabled} 人` },
    { label: '拾获登记', value: data.items.found_total, tip: `待认领 ${data.items.found_registered}` },
    { label: '失物启事', value: data.items.lost_total, tip: '由学生自主发布' },
    { label: '认领单', value: data.claims.total, tip: `在途 ${data.claims.pending}` },
    { label: '操作日志', value: data.audit_total, tip: '全量留痕' }
  ]
})

const rateRows = computed(() => {
  const rates = stats.value?.rates
  if (!rates) return []
  return [
    { label: '认领完成率', value: `${rates.completion_rate}%` },
    { label: '超时失效率', value: `${rates.timeout_rate}%` },
    { label: '平均审核时长', value: `${rates.avg_review_minutes} 分钟` }
  ]
})

async function load() {
  loading.value = true
  try {
    const [me, overview] = await Promise.all([getProfile(), getStatsOverview()])
    profile.value = me
    stats.value = overview
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
      description="管理员账号信息与全站运行摘要"
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
            type="danger"
            size="small"
            effect="plain"
          >
            {{ ROLE_LABEL[profile?.role ?? ''] || profile?.role || '-' }}
          </el-tag>
          <div class="profile-no">
            账号 {{ profile?.student_no || '-' }}
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
            <el-descriptions-item label="权限范围">
              全站读写
            </el-descriptions-item>
          </el-descriptions>

          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="资料修改说明"
            description="契约 v1 无修改资料 / 改密码接口。如账号信息有误，可由另一位管理员在「用户管理」中调整状态，或直接修改数据库。"
            style="margin-top: 12px"
          />
        </div>
      </el-col>
    </el-row>

    <div class="page-card">
      <div class="card-title">
        全站运行摘要
      </div>
      <div class="health-row">
        <div
          v-for="row in healthRows"
          :key="row.label"
          class="health-card"
        >
          <div class="health-card__label">
            {{ row.label }}
          </div>
          <div class="health-card__value">
            {{ row.value }}
          </div>
          <div class="health-card__tip">
            {{ row.tip }}
          </div>
        </div>
      </div>

      <div class="rate-row">
        <div
          v-for="row in rateRows"
          :key="row.label"
          class="rate-card"
        >
          <span class="rate-card__label">{{ row.label }}</span>
          <span class="rate-card__value">{{ row.value }}</span>
        </div>
      </div>
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
  background: #f56c6c;
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

.health-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.health-card {
  padding: 12px 14px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.health-card__label {
  font-size: 13px;
  color: #909399;
}

.health-card__value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

.health-card__tip {
  margin-top: 4px;
  font-size: 12px;
  color: #c0c4cc;
}

.rate-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.rate-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #f4f4f5;
  border-radius: 20px;
}

.rate-card__label {
  font-size: 12px;
  color: #909399;
}

.rate-card__value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
</style>
