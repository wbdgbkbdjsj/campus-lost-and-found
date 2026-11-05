<script setup lang="ts">
/**
 * A4 我的发布（拾获登记 / 失物启事 两个页签）
 *
 * 契约 v1 没有 /found-items?scope=mine，也没有按发布人过滤的参数，
 * 所以这里走的是「拉列表 + 按当前登录人 id 本地归属过滤」。
 * 页面顶部明确标注这一点，不做「服务端已按我筛选」的假象。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
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

const router = useRouter()
const auth = useAuthStore()

const activeTab = ref<'found' | 'lost'>('found')
const categories = ref<Category[]>([])
const lostList = ref<LostItem[]>([])
const lostLoading = ref(false)

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

/** 只保留 finder_id 等于当前登录人的记录 */
const myFoundList = computed(() => {
  const uid = auth.user?.id
  if (!uid) return []
  return list.value.filter((item) => item.finder_id === uid)
})

const myLostList = computed(() => {
  const uid = auth.user?.id
  if (!uid) return []
  return lostList.value.filter((item) => item.user_id === uid)
})

/** 本地统计：发布总量与仍在流转中的数量 */
const summary = computed(() => {
  const totalCount = myFoundList.value.length + myLostList.value.length
  const active =
    myFoundList.value.filter((item) => item.status === 'REGISTERED' || item.status === 'CLAIMING')
      .length + myLostList.value.filter((item) => item.status === 'OPEN').length
  return { total: totalCount, active, closed: totalCount - active }
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

function goDetail(row: FoundItem) {
  router.push(`/student/detail/${row.id}`)
}

function goPublish() {
  router.push('/student/publish')
}

onMounted(async () => {
  categories.value = await getCategories()
  await refreshAll()
})
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="我的发布"
      description="查看自己登记过的拾获物品与发布过的失物启事"
    >
      <template #extra>
        <el-button
          :icon="Refresh"
          @click="refreshAll"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          @click="goPublish"
        >
          去发布
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="归属说明"
      description="契约 v1 未提供按发布人查询的接口，本页在拉取列表后按当前登录人 ID 本地过滤，故仅能覆盖已加载的记录。"
      style="margin-bottom: 12px"
    />

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-card__label">
          发布总数
        </div>
        <div class="stat-card__value">
          {{ summary.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          流转中
        </div>
        <div class="stat-card__value stat-card__value--active">
          {{ summary.active }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          已结束
        </div>
        <div class="stat-card__value stat-card__value--muted">
          {{ summary.closed }}
        </div>
      </div>
    </div>

    <div class="page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane
          label="我的拾获登记"
          name="found"
        >
          <el-table
            v-loading="loading"
            :data="myFoundList"
            border
            stripe
          >
            <el-table-column
              prop="title"
              label="物品标题"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              label="分类"
              width="110"
            >
              <template #default="{ row }">
                {{ categoryName[row.category_id] || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              prop="found_location"
              label="拾获地点"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              label="拾获时间"
              width="150"
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
              width="100"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="goDetail(row)"
                >
                  查看
                </el-button>
              </template>
            </el-table-column>

            <template #empty>
              <EmptyState description="你还没有登记过拾获物品">
                <template #action>
                  <el-button
                    type="primary"
                    @click="goPublish"
                  >
                    去登记
                  </el-button>
                </template>
              </EmptyState>
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
          label="我的失物启事"
          name="lost"
        >
          <el-table
            v-loading="lostLoading"
            :data="myLostList"
            border
            stripe
          >
            <el-table-column
              prop="title"
              label="启事标题"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              label="分类"
              width="110"
            >
              <template #default="{ row }">
                {{ categoryName[row.category_id] || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              prop="lost_location"
              label="丢失地点"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              label="丢失时间"
              width="150"
            >
              <template #default="{ row }">
                {{ formatTime(row.lost_time) }}
              </template>
            </el-table-column>
            <el-table-column
              prop="description"
              label="描述"
              min-width="200"
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

            <template #empty>
              <EmptyState description="你还没有发布过失物启事" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped lang="scss">
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.stat-card__value--active {
  color: #e6a23c;
}

.stat-card__value--muted {
  color: #909399;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
