<script setup lang="ts">
/**
 * C7 操作日志
 *
 * GET /admin/audit-logs（契约 #29）支持 page / size。
 * 日志是系统所有写操作的留痕：认领流转、账号启停、字典新增都会写一条。
 * 契约没有按实体 / 按操作人过滤的参数，所以筛选放本地，页面标注清楚。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Download } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { pageAuditLogs } from '@/api/admin'
import { useTable } from '@/composables/useTable'
import type { AuditLog } from '@/types'
import { formatTime } from '@/utils/status'

const logs = useTable<AuditLog>((params) => pageAuditLogs(params), { keyword: '' })

const entityFilter = ref('')
const actionFilter = ref('')
const drawerVisible = ref(false)
const current = ref<AuditLog | null>(null)

const entityOptions = computed(() => Array.from(new Set(logs.list.value.map((one) => one.entity))))

const actionOptions = computed(() => Array.from(new Set(logs.list.value.map((one) => one.action))))

const filteredList = computed(() =>
  logs.list.value.filter((row) => {
    if (entityFilter.value && row.entity !== entityFilter.value) return false
    if (actionFilter.value && row.action !== actionFilter.value) return false
    return true
  })
)

/** 按实体聚合，快速看出哪类写操作最频繁 */
const entitySummary = computed(() => {
  const map: Record<string, number> = {}
  logs.list.value.forEach((row) => {
    map[row.entity] = (map[row.entity] ?? 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

function actionTagType(action: string) {
  const text = action.toUpperCase()
  if (text.includes('DELETE') || text.includes('DISABLE') || text.includes('REJECT')) return 'danger'
  if (text.includes('CREATE') || text.includes('APPROVE') || text.includes('ENABLE')) return 'success'
  if (text.includes('UPDATE') || text.includes('STATUS')) return 'warning'
  return 'primary'
}

function openDetail(row: AuditLog) {
  current.value = row
  drawerVisible.value = true
}

/** 把当前页日志导成 CSV，方便离线核对（纯前端生成，不依赖后端导出接口） */
function exportCurrentPage() {
  if (filteredList.value.length === 0) {
    ElMessage.warning('当前没有可导出的日志')
    return
  }
  const header = ['id', 'actor_id', 'entity', 'entity_id', 'action', 'detail', 'created_at']
  const rows = filteredList.value.map((row) =>
    [
      row.id,
      row.actor_id,
      row.entity,
      row.entity_id,
      row.action,
      (row.detail ?? '').replace(/[\r\n,]/g, ' '),
      row.created_at ?? ''
    ].join(',')
  )
  const csv = `\uFEFF${[header.join(','), ...rows].join('\n')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `操作日志-第${logs.query.value.page}页.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success('当前页日志已导出')
}

function resetFilters() {
  entityFilter.value = ''
  actionFilter.value = ''
}

onMounted(logs.load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="操作日志"
      description="系统写操作留痕，可核对谁在什么时候改了哪条数据"
    >
      <template #extra>
        <el-button
          :icon="Download"
          @click="exportCurrentPage"
        >
          导出本页
        </el-button>
        <el-button
          :icon="Refresh"
          @click="logs.load"
        >
          刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="page-card">
      <div class="toolbar">
        <el-select
          v-model="entityFilter"
          placeholder="全部实体"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="entity in entityOptions"
            :key="entity"
            :label="entity"
            :value="entity"
          />
        </el-select>
        <el-select
          v-model="actionFilter"
          placeholder="全部操作"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="action in actionOptions"
            :key="action"
            :label="action"
            :value="action"
          />
        </el-select>
        <el-button
          text
          @click="resetFilters"
        >
          重置
        </el-button>
        <span class="hint">实体与操作为本页本地筛选</span>
      </div>

      <div class="summary-row">
        <el-tag
          v-for="[entity, count] in entitySummary"
          :key="entity"
          type="info"
          effect="plain"
        >
          {{ entity }} × {{ count }}
        </el-tag>
        <span
          v-if="entitySummary.length === 0"
          class="hint"
        >本页暂无日志</span>
      </div>

      <el-table
        v-loading="logs.loading.value"
        :data="filteredList"
        border
        stripe
        size="small"
      >
        <el-table-column
          prop="id"
          label="日志号"
          width="90"
        />
        <el-table-column
          label="操作人"
          width="110"
        >
          <template #default="{ row }">
            #{{ row.actor_id }}
          </template>
        </el-table-column>
        <el-table-column
          prop="entity"
          label="实体"
          width="130"
        />
        <el-table-column
          label="实体 ID"
          width="100"
        >
          <template #default="{ row }">
            #{{ row.entity_id }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="140"
        >
          <template #default="{ row }">
            <el-tag
              :type="actionTagType(row.action)"
              size="small"
              effect="plain"
            >
              {{ row.action }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="detail"
          label="详情"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column
          label="时间"
          width="160"
        >
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="80"
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
          </template>
        </el-table-column>

        <template #empty>
          <EmptyState description="暂无操作日志" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="logs.query.value.page"
          v-model:page-size="logs.query.value.size"
          :total="logs.total.value"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="logs.onPageChange"
          @size-change="logs.search"
        />
      </div>
    </div>

    <el-dialog
      v-model="drawerVisible"
      title="日志详情"
      width="520px"
    >
      <template v-if="current">
        <el-descriptions
          :column="1"
          border
          size="small"
        >
          <el-descriptions-item label="日志号">
            #{{ current.id }}
          </el-descriptions-item>
          <el-descriptions-item label="操作人">
            #{{ current.actor_id }}
          </el-descriptions-item>
          <el-descriptions-item label="实体">
            {{ current.entity }} #{{ current.entity_id }}
          </el-descriptions-item>
          <el-descriptions-item label="操作">
            {{ current.action }}
          </el-descriptions-item>
          <el-descriptions-item label="时间">
            {{ formatTime(current.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="详情">
            {{ current.detail || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <template #footer>
        <el-button
          type="primary"
          @click="drawerVisible = false"
        >
          关闭
        </el-button>
      </template>
    </el-dialog>
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

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
