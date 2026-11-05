<script setup lang="ts">
/**
 * A7 消息通知
 *
 * 后端只有 GET /notifications（返回当前登录人的通知，已按 id 倒序），
 * 契约里没有「标记已读」写接口，也没有群发公告接口。
 * 因此本页只做展示 + 前端筛选，并如实说明「已读状态由后端 is_read 决定，前端无写回」。
 */
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import { getNotifications } from '@/api/notice'
import type { Notification } from '@/types'
import { formatTime } from '@/utils/status'

const list = ref<Notification[]>([])
const loading = ref(false)
const filter = ref<'all' | 'unread' | 'read'>('all')
const keyword = ref('')

const dialogVisible = ref(false)
const current = ref<Notification | null>(null)

const unreadCount = computed(() => list.value.filter((item) => !item.is_read).length)

const filteredList = computed(() =>
  list.value.filter((item) => {
    if (filter.value === 'unread' && item.is_read) return false
    if (filter.value === 'read' && !item.is_read) return false
    if (keyword.value) {
      const text = `${item.title} ${item.content}`
      if (!text.includes(keyword.value.trim())) return false
    }
    return true
  })
)

async function load() {
  loading.value = true
  try {
    const result = await getNotifications()
    list.value = result.items
  } finally {
    loading.value = false
  }
}

function openNotice(row: Notification) {
  current.value = row
  dialogVisible.value = true
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="消息通知"
      description="认领单被接单、审核通过、驳回或退回补充时，系统会在这里留一条通知"
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

    <div class="page-card">
      <div class="toolbar">
        <el-radio-group v-model="filter">
          <el-radio-button value="all">
            全部（{{ list.length }}）
          </el-radio-button>
          <el-radio-button value="unread">
            未读（{{ unreadCount }}）
          </el-radio-button>
          <el-radio-button value="read">
            已读（{{ list.length - unreadCount }}）
          </el-radio-button>
        </el-radio-group>

        <el-input
          v-model="keyword"
          placeholder="搜标题或正文"
          clearable
          style="width: 220px"
        />

        <span class="hint">筛选在本地进行</span>
      </div>

      <div
        v-loading="loading"
        class="notice-list"
      >
        <el-empty
          v-if="!loading && filteredList.length === 0"
          description="暂无通知"
        />
        <div
          v-for="item in filteredList"
          :key="item.id"
          class="notice-item"
          :class="{ 'notice-item--unread': !item.is_read }"
          @click="openNotice(item)"
        >
          <div class="notice-item__head">
            <span class="notice-item__title">{{ item.title }}</span>
            <el-tag
              v-if="!item.is_read"
              type="danger"
              size="small"
              effect="plain"
            >
              未读
            </el-tag>
            <span class="notice-item__time">{{ formatTime(item.created_at) }}</span>
          </div>
          <div class="notice-item__body">
            {{ item.content }}
          </div>
        </div>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="说明"
        description="契约 v1 未提供标记已读 / 删除通知的写接口，已读状态由后端 is_read 字段决定，本页只做展示。"
        style="margin-top: 12px"
      />
    </div>

    <el-dialog
      v-model="dialogVisible"
      title="通知详情"
      width="520px"
    >
      <template v-if="current">
        <div class="dialog-title">
          {{ current.title }}
        </div>
        <div class="dialog-meta">
          接收人 #{{ current.user_id ?? '-' }} · {{ formatTime(current.created_at) }}
        </div>
        <div class="dialog-content">
          {{ current.content }}
        </div>
      </template>
      <template #footer>
        <el-button
          type="primary"
          @click="dialogVisible = false"
        >
          知道了
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
  gap: 12px;
  margin-bottom: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.notice-list {
  min-height: 160px;
}

.notice-item {
  padding: 12px 14px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: #c6e2ff;
  }
}

.notice-item--unread {
  background: #fdf6ec;
  border-color: #faecd8;
}

.notice-item__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notice-item__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.notice-item__time {
  margin-left: auto;
  font-size: 12px;
  color: #909399;
}

.notice-item__body {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
