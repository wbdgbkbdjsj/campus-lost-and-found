<script setup lang="ts">
/**
 * A1 失物招领大厅（学生端首页）
 *
 * 后端 GET /found-items 目前只支持 keyword 检索（见 lost-found-prototype/main.py），
 * 因此关键词走后端，分类 / 地点做当前页本地筛选——页面上明确标注，不假装是服务端筛选。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { useTable } from '@/composables/useTable'
import { pageFoundItems } from '@/api/item'
import { getCategories, getLocations } from '@/api/dict'
import type { Category, FoundItem, Location } from '@/types'
import { formatTime, foundStatusText, foundTagType } from '@/utils/status'

const router = useRouter()

const categories = ref<Category[]>([])
const locations = ref<Location[]>([])
const filterCategory = ref<number | ''>('')
const filterLocation = ref('')

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

/** 本地筛选：只在当前页内过滤，避免让用户误以为是全量筛选 */
const visibleList = computed(() =>
  list.value.filter((item) => {
    const hitCategory =
      filterCategory.value === '' || item.category_id === Number(filterCategory.value)
    const hitLocation =
      !filterLocation.value || (item.found_location || '').includes(filterLocation.value)
    return hitCategory && hitLocation
  })
)

function resetFilters() {
  filterCategory.value = ''
  filterLocation.value = ''
}

function goDetail(item: FoundItem) {
  router.push(`/student/detail/${item.id}`)
}

function goClaim(item: FoundItem) {
  router.push(`/student/claim-apply/${item.id}`)
}

onMounted(async () => {
  const [categoryList, locationList] = await Promise.all([getCategories(), getLocations()])
  categories.value = categoryList
  locations.value = locationList
  await load()
})
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="失物招领大厅"
      description="按关键词检索拾获物品，看到熟悉的就直接提交认领申请"
    />

    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="query.keyword"
          placeholder="搜物品标题，例如：雨伞 / 耳机 / 水杯"
          clearable
          style="width: 280px"
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
          v-model="filterCategory"
          placeholder="全部分类"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="item in categories"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>

        <el-select
          v-model="filterLocation"
          placeholder="全部地点"
          clearable
          filterable
          style="width: 170px"
        >
          <el-option
            v-for="item in locations"
            :key="item.id"
            :label="item.name"
            :value="item.name"
          />
        </el-select>

        <el-button
          text
          @click="resetFilters"
        >
          重置
        </el-button>

        <span class="hint">分类与地点为当前页本地筛选</span>
      </div>

      <el-table
        v-loading="loading"
        :data="visibleList"
        border
        stripe
        empty-text="暂时没有符合条件的拾获物品"
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
          label="存放点"
          min-width="130"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.storage_location || '未登记' }}
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
          width="170"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="goDetail(row)"
            >
              查看详情
            </el-button>
            <el-button
              link
              type="success"
              :disabled="row.status !== 'REGISTERED'"
              @click="goClaim(row)"
            >
              我要认领
            </el-button>
          </template>
        </el-table-column>
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
