<script setup lang="ts">
/**
 * C4 物品管理
 *
 * 数据源复用公共物品接口：GET /found-items（分页 + keyword）、GET /lost-items。
 * 契约没有 /admin/items、也没有下架 / 编辑物品的接口，所以本页是「全量浏览 + 状态筛选」，
 * 不提供无法落库的删除按钮。
 */
import { computed, onMounted, ref } from 'vue'
import { Search, Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useTable } from '@/composables/useTable'
import { pageFoundItems, pageLostItems } from '@/api/item'
import { getCategories } from '@/api/dict'
import type { Category, FoundItem, LostItem } from '@/types'
import {
  formatTime,
  foundStatusText,
  foundTagType,
  lostStatusText,
  lostTagType
} from '@/utils/status'

const activeTab = ref<'found' | 'lost'>('found')
const categories = ref<Category[]>([])
const lostList = ref<LostItem[]>([])
const lostLoading = ref(false)
const foundStatus = ref('')
const lostStatus = ref('')

const drawerVisible = ref(false)
const currentFound = ref<FoundItem | null>(null)
const currentLost = ref<LostItem | null>(null)

const { list, total, loading, query, load, search, onPageChange } = useTable<FoundItem>(
  (params) => pageFoundItems(params),
  { keyword: '' }
)

const categoryName = computed<Record<number, string>>(() => {
  const map: Record<number, string> = {}
  categories.value.forEach((item) => {
    map[item.id] = item.name
  })
  return map
})

const foundRows = computed(() =>
  foundStatus.value ? list.value.filter((row) => row.status === foundStatus.value) : list.value
)

const lostRows = computed(() =>
  lostStatus.value ? lostList.value.filter((row) => row.status === lostStatus.value) : lostList.value
)

/** 拾获物品各状态在本页的分布，便于判断流转是否健康 */
const foundDistribution = computed(() => {
  const map: Record<string, number> = {}
  list.value.forEach((row) => {
    map[row.status] = (map[row.status] ?? 0) + 1
  })
  return map
})

async function loadLost() {
  lostLoading.value = true
  try {
    const result = await pageLostItems({ page: 1, size: 100 })
    lostList.value = result.items
  } finally {
    lostLoading.value = false
  }
}

async function refreshAll() {
  await Promise.all([load(), loadLost()])
}

function openFound(row: FoundItem) {
  currentFound.value = row
  currentLost.value = null
  drawerVisible.value = true
}

function openLost(row: LostItem) {
  currentLost.value = row
  currentFound.value = null
  drawerVisible.value = true
}

onMounted(async () => {
  categories.value = await getCategories()
  await refreshAll()
})
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="物品管理"
      description="浏览全站拾获登记与失物启事，按状态核对流转情况"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="refreshAll"
        >
          刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="stat-row">
      <div
        v-for="(count, status) in foundDistribution"
        :key="status"
        class="stat-card"
      >
        <div class="stat-card__label">
          {{ foundStatusText(String(status)) }}
        </div>
        <div class="stat-card__value">
          {{ count }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          失物启事
        </div>
        <div class="stat-card__value">
          {{ lostList.length }}
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="query.keyword"
          placeholder="搜物品标题"
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
          v-if="activeTab === 'found'"
          v-model="foundStatus"
          placeholder="全部状态"
          clearable
          style="width: 150px"
        >
          <el-option
            label="已登记"
            value="REGISTERED"
          />
          <el-option
            label="认领中"
            value="CLAIMING"
          />
          <el-option
            label="待领取"
            value="PICKUP_PENDING"
          />
          <el-option
            label="已认领"
            value="CLAIMED"
          />
          <el-option
            label="已关闭"
            value="CLOSED"
          />
        </el-select>
        <el-select
          v-else
          v-model="lostStatus"
          placeholder="全部状态"
          clearable
          style="width: 150px"
        >
          <el-option
            label="寻找中"
            value="OPEN"
          />
          <el-option
            label="已匹配"
            value="MATCHED"
          />
          <el-option
            label="已关闭"
            value="CLOSED"
          />
        </el-select>
        <span class="hint">状态为本地筛选</span>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane
          label="拾获登记"
          name="found"
        >
          <el-table
            v-loading="loading"
            :data="foundRows"
            border
            stripe
          >
            <el-table-column
              prop="id"
              label="编号"
              width="80"
            />
            <el-table-column
              prop="title"
              label="标题"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column
              label="分类"
              width="100"
            >
              <template #default="{ row }">
                {{ categoryName[row.category_id] || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              prop="found_location"
              label="拾获地点"
              min-width="130"
              show-overflow-tooltip
            />
            <el-table-column
              prop="storage_location"
              label="存放点"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column
              label="拾获时间"
              width="140"
            >
              <template #default="{ row }">
                {{ formatTime(row.found_time) }}
              </template>
            </el-table-column>
            <el-table-column
              label="状态"
              width="100"
            >
              <template #default="{ row }">
                <StatusTag
                  :text="foundStatusText(row.status)"
                  :type="foundTagType(row.status)"
                />
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="90"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="openFound(row)"
                >
                  查看
                </el-button>
              </template>
            </el-table-column>

            <template #empty>
              <EmptyState description="没有符合条件的拾获物品" />
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
        </el-tab-pane>

        <el-tab-pane
          label="失物启事"
          name="lost"
        >
          <el-table
            v-loading="lostLoading"
            :data="lostRows"
            border
            stripe
          >
            <el-table-column
              prop="id"
              label="编号"
              width="80"
            />
            <el-table-column
              prop="title"
              label="标题"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column
              label="分类"
              width="100"
            >
              <template #default="{ row }">
                {{ categoryName[row.category_id] || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              prop="lost_location"
              label="丢失地点"
              min-width="130"
              show-overflow-tooltip
            />
            <el-table-column
              label="丢失时间"
              width="140"
            >
              <template #default="{ row }">
                {{ formatTime(row.lost_time) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="description"
              label="描述"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column
              label="状态"
              width="100"
            >
              <template #default="{ row }">
                <StatusTag
                  :text="lostStatusText(row.status)"
                  :type="lostTagType(row.status)"
                />
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="90"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="openLost(row)"
                >
                  查看
                </el-button>
              </template>
            </el-table-column>

            <template #empty>
              <EmptyState description="没有符合条件的失物启事" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="currentFound ? '拾获物品详情' : '失物启事详情'"
      size="460px"
    >
      <el-descriptions
        v-if="currentFound"
        :column="1"
        border
        size="small"
      >
        <el-descriptions-item label="编号">
          #{{ currentFound.id }}
        </el-descriptions-item>
        <el-descriptions-item label="标题">
          {{ currentFound.title }}
        </el-descriptions-item>
        <el-descriptions-item label="分类">
          {{ categoryName[currentFound.category_id] || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <StatusTag
            :text="foundStatusText(currentFound.status)"
            :type="foundTagType(currentFound.status)"
          />
        </el-descriptions-item>
        <el-descriptions-item label="拾获地点">
          {{ currentFound.found_location || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="存放点">
          {{ currentFound.storage_location || '未登记' }}
        </el-descriptions-item>
        <el-descriptions-item label="拾获时间">
          {{ formatTime(currentFound.found_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述">
          {{ currentFound.description || '未填写' }}
        </el-descriptions-item>
        <el-descriptions-item label="登记时间">
          {{ formatTime(currentFound.created_at) }}
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions
        v-else-if="currentLost"
        :column="1"
        border
        size="small"
      >
        <el-descriptions-item label="编号">
          #{{ currentLost.id }}
        </el-descriptions-item>
        <el-descriptions-item label="标题">
          {{ currentLost.title }}
        </el-descriptions-item>
        <el-descriptions-item label="分类">
          {{ categoryName[currentLost.category_id] || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <StatusTag
            :text="lostStatusText(currentLost.status)"
            :type="lostTagType(currentLost.status)"
          />
        </el-descriptions-item>
        <el-descriptions-item label="丢失地点">
          {{ currentLost.lost_location || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="丢失时间">
          {{ formatTime(currentLost.lost_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述">
          {{ currentLost.description || '未填写' }}
        </el-descriptions-item>
        <el-descriptions-item label="发布时间">
          {{ formatTime(currentLost.created_at) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
