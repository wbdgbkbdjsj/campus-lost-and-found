<script setup lang="ts">
/**
 * C2 用户管理
 *
 * GET /admin/users 支持 page / size / keyword；角色筛选契约里没有对应参数，
 * 所以角色与状态筛选放本地，并在页面上标注清楚。
 * 启停用走 PUT /admin/users/{id}/status（body: { status }），
 * 契约明确禁止停用自己，页面在按钮层面先拦一道，减少一次报错往返。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { pageUsers, setUserStatus } from '@/api/admin'
import { useAuthStore } from '@/stores/auth'
import { useTable } from '@/composables/useTable'
import type { SysUser } from '@/types'
import { ROLE_LABEL, ROLE_STUDENT, ROLE_REVIEWER, ROLE_SUPER_ADMIN } from '@/utils/constants'
import { formatTime } from '@/utils/status'
import { maskPhone } from '@/utils/format'

const auth = useAuthStore()
const roleFilter = ref('')
const statusFilter = ref('')
const togglingId = ref<number | null>(null)

const { list, total, loading, query, load, search, onPageChange } = useTable<SysUser>(
  (params) => pageUsers(params),
  { keyword: '' }
)

const roleOptions = [
  { value: ROLE_STUDENT, label: ROLE_LABEL[ROLE_STUDENT] },
  { value: ROLE_REVIEWER, label: ROLE_LABEL[ROLE_REVIEWER] },
  { value: ROLE_SUPER_ADMIN, label: ROLE_LABEL[ROLE_SUPER_ADMIN] }
]

const filteredList = computed(() =>
  list.value.filter((item) => {
    if (roleFilter.value && item.role !== roleFilter.value) return false
    if (statusFilter.value && item.status !== statusFilter.value) return false
    return true
  })
)

const summary = computed(() => {
  const bucket = { total: list.value.length, active: 0, disabled: 0, staff: 0 }
  list.value.forEach((item) => {
    if (item.status === 'ACTIVE') bucket.active += 1
    else bucket.disabled += 1
    if (item.role === ROLE_REVIEWER || item.role === ROLE_SUPER_ADMIN) bucket.staff += 1
  })
  return bucket
})

function roleTagType(role: string) {
  if (role === ROLE_SUPER_ADMIN) return 'danger'
  if (role === ROLE_REVIEWER) return 'warning'
  return 'primary'
}

async function toggleStatus(row: SysUser) {
  if (row.id === auth.user?.id) {
    ElMessage.warning('不能停用自己的账号，请让其他管理员操作')
    return
  }
  const next = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  const verb = next === 'DISABLED' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(
      next === 'DISABLED'
        ? `停用后 ${row.name}（${row.student_no}）将无法登录，已提交的认领单不受影响。确定停用吗？`
        : `确定启用 ${row.name}（${row.student_no}）的账号吗？`,
      `${verb}账号`,
      { type: next === 'DISABLED' ? 'warning' : 'info', confirmButtonText: verb, cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  togglingId.value = row.id
  try {
    await setUserStatus(row.id, next)
    ElMessage.success(`已${verb} ${row.name}`)
    await load()
  } finally {
    togglingId.value = null
  }
}

function resetFilters() {
  roleFilter.value = ''
  statusFilter.value = ''
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="用户管理"
      description="查看全部账号并控制启停状态，停用账号无法登录"
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
          本页账号
        </div>
        <div class="stat-card__value">
          {{ summary.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          正常
        </div>
        <div class="stat-card__value stat-card__value--success">
          {{ summary.active }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          已停用
        </div>
        <div class="stat-card__value stat-card__value--muted">
          {{ summary.disabled }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          审核员 / 管理员
        </div>
        <div class="stat-card__value stat-card__value--warning">
          {{ summary.staff }}
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="query.keyword"
          placeholder="搜姓名或学号"
          clearable
          style="width: 240px"
          :prefix-icon="Search"
          @keyup.enter="search"
          @clear="search"
        />
        <el-button
          type="primary"
          @click="search"
        >
          搜索
        </el-button>
        <el-select
          v-model="roleFilter"
          placeholder="全部角色"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="item in roleOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select
          v-model="statusFilter"
          placeholder="全部状态"
          clearable
          style="width: 140px"
        >
          <el-option
            label="正常"
            value="ACTIVE"
          />
          <el-option
            label="已停用"
            value="DISABLED"
          />
        </el-select>
        <el-button
          text
          @click="resetFilters"
        >
          重置
        </el-button>
        <span class="hint">关键词走后端，角色 / 状态为本地筛选</span>
      </div>

      <el-table
        v-loading="loading"
        :data="filteredList"
        border
        stripe
      >
        <el-table-column
          prop="id"
          label="ID"
          width="70"
        />
        <el-table-column
          prop="name"
          label="姓名"
          width="120"
        />
        <el-table-column
          prop="student_no"
          label="学号 / 工号"
          width="140"
        />
        <el-table-column
          label="角色"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              :type="roleTagType(row.role)"
              size="small"
              effect="plain"
            >
              {{ ROLE_LABEL[row.role] || row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="手机号"
          width="140"
        >
          <template #default="{ row }">
            {{ maskPhone(row.phone) }}
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="100"
        >
          <template #default="{ row }">
            <el-tag
              :type="row.status === 'ACTIVE' ? 'success' : 'info'"
              size="small"
            >
              {{ row.status === 'ACTIVE' ? '正常' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="创建时间"
          width="160"
        >
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="130"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              :type="row.status === 'ACTIVE' ? 'danger' : 'success'"
              :loading="togglingId === row.id"
              :disabled="row.id === auth.user?.id"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
            </el-button>
            <el-tooltip
              v-if="row.id === auth.user?.id"
              content="不能操作自己的账号"
              placement="top"
            >
              <span class="self-tip">当前账号</span>
            </el-tooltip>
          </template>
        </el-table-column>

        <template #empty>
          <EmptyState description="没有符合条件的账号" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="onPageChange"
          @size-change="search"
        />
      </div>
    </div>
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

.stat-card__value--success {
  color: #67c23a;
}

.stat-card__value--warning {
  color: #e6a23c;
}

.stat-card__value--muted {
  color: #909399;
}

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

.self-tip {
  font-size: 12px;
  color: #c0c4cc;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
