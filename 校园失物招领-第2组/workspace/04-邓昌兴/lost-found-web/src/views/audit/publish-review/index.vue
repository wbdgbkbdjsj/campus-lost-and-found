<script setup lang="ts">
/**
 * B2 发布审核（发布质量核查）
 *
 * 契约对齐说明：v1 里拾获登记提交即生效（POST /found-items 直接返回 REGISTERED），
 * 物品没有「待审核」状态，也没有审核发布内容的接口。
 * 所以本页不做假的三态审批，而是做数据库层面的「发布质量核查」：
 *   - 浏览全部拾获登记与失物启事；
 *   - 标出缺关键字段（无存放点 / 无描述 / 无时间）的记录，供审核员线下找发布人补齐；
 *   - 点开抽屉看完整信息与当前状态。
 * 页面顶部把这个定位写清楚，不让人误以为是审批台。
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
const onlyIncomplete = ref(false)

const drawerVisible = ref(false)
const currentFound = ref<FoundItem | null>(null)

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

/** 完整性判定：缺存放点、缺描述、缺时间任一即为待补齐 */
function missingFields(row: FoundItem): string[] {
  const missing: string[] = []
  if (!row.description) missing.push('描述')
  if (!row.storage_location) missing.push('存放点')
  if (!row.found_time) missing.push('拾获时间')
  if (!row.found_location) missing.push('拾获地点')
  return missing
}

function lostMissingFields(row: LostItem): string[] {
  const missing: string[] = []
  if (!row.description) missing.push('描述')
  if (!row.lost_location) missing.push('丢失地点')
  if (!row.lost_time) missing.push('丢失时间')
  return missing
}

const foundRows = computed(() =>
  onlyIncomplete.value ? list.value.filter((row) => missingFields(row).length > 0) : list.value
)

const lostRows = computed(() =>
  onlyIncomplete.value
    ? lostList.value.filter((row) => lostMissingFields(row).length > 0)
    : lostList.value
)

const summary = computed(() => {
  const foundIncomplete = list.value.filter((row) => missingFields(row).length > 0).length
  const lostIncomplete = lostList.value.filter((row) => lostMissingFields(row).length > 0).length
  return {
    foundTotal: list.value.length,
    lostTotal: lostList.value.length,
    incomplete: foundIncomplete + lostIncomplete
  }
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
      title="发布审核"
      description="核查拾获登记与失物启事的字段完整性，缺项记录线下联系发布人补齐"
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

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="流程定位"
      description="契约 v1 中拾获登记提交即生效（状态 REGISTERED），不存在「待审核」态，也没有发布审核接口。本页做的是质量核查，不改变物品状态。"
      style="margin-bottom: 12px"
    />

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-card__label">
          拾获登记（本页）
        </div>
        <div class="stat-card__value">
          {{ summary.foundTotal }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          失物启事
        </div>
        <div class="stat-card__value">
          {{ summary.lostTotal }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">
          字段待补齐
        </div>
        <div class="stat-card__value stat-card__value--warning">
          {{ summary.incomplete }}
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
        <el-switch
          v-model="onlyIncomplete"
          active-text="只看字段缺失"
          inline-prompt
        />
        <span class="hint">关键词走后端检索，字段缺失为本地判定</span>
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
              label="缺失字段"
              min-width="150"
            >
              <template #default="{ row }">
                <template v-if="missingFields(row).length">
                  <el-tag
                    v-for="field in missingFields(row)"
                    :key="field"
                    type="warning"
                    size="small"
                    effect="plain"
                    class="field-tag"
                  >
                    {{ field }}
                  </el-tag>
                </template>
                <span
                  v-else
                  class="complete-text"
                >完整</span>
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
              <EmptyState description="没有符合条件的拾获登记" />
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
              label="缺失字段"
              min-width="150"
            >
              <template #default="{ row }">
                <template v-if="lostMissingFields(row).length">
                  <el-tag
                    v-for="field in lostMissingFields(row)"
                    :key="field"
                    type="warning"
                    size="small"
                    effect="plain"
                    class="field-tag"
                  >
                    {{ field }}
                  </el-tag>
                </template>
                <span
                  v-else
                  class="complete-text"
                >完整</span>
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
      title="拾获物品详情"
      size="480px"
    >
      <template v-if="currentFound">
        <el-descriptions
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
          <el-descriptions-item label="拾获时间">
            {{ formatTime(currentFound.found_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="存放点">
            {{ currentFound.storage_location || '未登记' }}
          </el-descriptions-item>
          <el-descriptions-item label="描述">
            {{ currentFound.description || '未填写' }}
          </el-descriptions-item>
          <el-descriptions-item label="图片链接">
            {{ currentFound.image_url || '无' }}
          </el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-if="missingFields(currentFound).length"
          type="warning"
          :closable="false"
          show-icon
          :title="`建议补齐：${missingFields(currentFound).join('、')}`"
          description="字段缺失会影响失主检索命中率，建议提醒发布人补全。"
          style="margin-top: 12px"
        />
      </template>
    </el-drawer>
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

.stat-card__value--warning {
  color: #e6a23c;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.field-tag {
  margin-right: 4px;
}

.complete-text {
  font-size: 12px;
  color: #67c23a;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
