<script setup lang="ts">
/**
 * C6 公告管理
 *
 * 契约现状：v1 只有 GET /notifications（读取当前登录人的通知），
 * 没有「群发公告」写接口，也没有公告的增删改查。
 * 所以本页做两件事：
 *   1) 展示当前账号收到的通知（真实接口），可按已读状态与关键词过滤；
 *   2) 把「群发公告」的能力缺口如实标出来，并给出后端补齐后的接入点，
 *      不做一个提交必然失败的假表单。
 */
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { getNotifications } from '@/api/notice'
import type { Notification } from '@/types'
import { formatTime } from '@/utils/status'

const list = ref<Notification[]>([])
const loading = ref(false)
const keyword = ref('')
const readFilter = ref<'' | 'read' | 'unread'>('')
const drawerVisible = ref(false)
const current = ref<Notification | null>(null)

/** 群发表单只做静态展示，按钮禁用并说明原因 */
const draftTitle = ref('')
const draftContent = ref('')

const filteredList = computed(() =>
  list.value.filter((item) => {
    if (readFilter.value === 'read' && !item.is_read) return false
    if (readFilter.value === 'unread' && item.is_read) return false
    if (keyword.value) {
      const text = `${item.title} ${item.content}`
      if (!text.includes(keyword.value.trim())) return false
    }
    return true
  })
)

const summary = computed(() => ({
  total: list.value.length,
  unread: list.value.filter((item) => !item.is_read).length
}))

async function load() {
  loading.value = true
  try {
    const result = await getNotifications()
    list.value = result.items
  } finally {
    loading.value = false
  }
}

function openItem(row: Notification) {
  current.value = row
  drawerVisible.value = true
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="公告管理"
      description="查看系统通知；群发公告需后端补接口后启用"
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

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="能力缺口：契约 v1 无群发公告接口"
      description="现有接口只有 GET /notifications（读本人通知），没有 POST 公告或批量写通知的入口。前端不伪造提交路径，待后端补齐后再接入。"
      style="margin-bottom: 12px"
    />

    <el-row :gutter="12">
      <el-col :span="16">
        <div class="page-card">
          <div class="card-title">
            通知记录（{{ summary.total }} 条，未读 {{ summary.unread }} 条）
          </div>
          <div class="toolbar">
            <el-input
              v-model="keyword"
              placeholder="搜标题或正文"
              clearable
              style="width: 220px"
            />
            <el-select
              v-model="readFilter"
              placeholder="全部"
              clearable
              style="width: 130px"
            >
              <el-option
                label="未读"
                value="unread"
              />
              <el-option
                label="已读"
                value="read"
              />
            </el-select>
            <span class="hint">筛选在本地进行</span>
          </div>

          <el-table
            v-loading="loading"
            :data="filteredList"
            border
            stripe
            size="small"
          >
            <el-table-column
              prop="id"
              label="ID"
              width="70"
            />
            <el-table-column
              prop="title"
              label="标题"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="content"
              label="正文"
              min-width="240"
              show-overflow-tooltip
            />
            <el-table-column
              label="状态"
              width="90"
            >
              <template #default="{ row }">
                <el-tag
                  :type="row.is_read ? 'info' : 'danger'"
                  size="small"
                  effect="plain"
                >
                  {{ row.is_read ? '已读' : '未读' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              label="时间"
              width="150"
            >
              <template #default="{ row }">
                {{ formatTime(row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="80"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="openItem(row)"
                >
                  查看
                </el-button>
              </template>
            </el-table-column>

            <template #empty>
              <EmptyState description="暂无通知记录" />
            </template>
          </el-table>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="page-card">
          <div class="card-title">
            群发公告（未启用）
          </div>
          <el-form label-width="60px">
            <el-form-item label="标题">
              <el-input
                v-model="draftTitle"
                placeholder="例如：期末考试周失物集中认领通知"
                disabled
              />
            </el-form-item>
            <el-form-item label="正文">
              <el-input
                v-model="draftContent"
                type="textarea"
                :rows="4"
                placeholder="公告正文"
                disabled
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                disabled
              >
                发布公告
              </el-button>
            </el-form-item>
          </el-form>

          <el-alert
            type="info"
            :closable="false"
            title="后端补齐后的接入方式"
            description="1) 新增 POST /admin/notices 写入公告表；2) 新增 POST /admin/notices/{id}/push 按角色批量写 notification；3) 前端在本表单解除 disabled 并调用对应接口。"
          />
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="drawerVisible"
      title="通知详情"
      width="500px"
    >
      <template v-if="current">
        <div class="dialog-title">
          {{ current.title }}
        </div>
        <div class="dialog-meta">
          #{{ current.id }} · {{ formatTime(current.created_at) }}
        </div>
        <div class="dialog-content">
          {{ current.content }}
        </div>
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
.card-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
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

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.dialog-meta {
  margin: 6px 0 12px;
  font-size: 12px;
  color: #909399;
}

.dialog-content {
  font-size: 13px;
  line-height: 1.8;
  color: #606266;
  white-space: pre-wrap;
}
</style>
