<script setup lang="ts">
/**
 * C3 分类管理（分类字典 + 地点字典）
 *
 * 读写接口：
 *   GET  /admin/dict/categories   POST /admin/dict/categories
 *   GET  /admin/dict/locations    POST /admin/dict/locations
 * 契约里没有改 / 删字典的接口，所以本页只做「查询 + 新增」，
 * 不给出无法落库的编辑按钮，避免演示时点了没反应。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Plus } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import EmptyState from '@/components/EmptyState.vue'
import {
  createCategory,
  createLocation,
  getAdminCategories,
  getAdminLocations
} from '@/api/admin'
import type { Category, Location } from '@/types'

const categories = ref<Category[]>([])
const locations = ref<Location[]>([])
const loading = ref(false)
const keyword = ref('')

const categoryVisible = ref(false)
const locationVisible = ref(false)
const submitting = ref(false)
const categoryFormRef = ref<FormInstance>()
const locationFormRef = ref<FormInstance>()

const categoryForm = reactive({ name: '', sort_order: 0 })
const locationForm = reactive({ name: '', sort_order: 0 })

const nameRules = (label: string): FormRules => ({
  name: [
    { required: true, message: `请填写${label}名称`, trigger: 'blur' },
    { min: 1, max: 20, message: `${label}名称 1-20 个字符`, trigger: 'blur' }
  ]
})

const categoryRules = nameRules('分类')
const locationRules = nameRules('地点')

const filteredCategories = computed(() =>
  keyword.value
    ? categories.value.filter((item) => item.name.includes(keyword.value.trim()))
    : categories.value
)

const filteredLocations = computed(() =>
  keyword.value
    ? locations.value.filter((item) => item.name.includes(keyword.value.trim()))
    : locations.value
)

async function load() {
  loading.value = true
  try {
    const [categoryList, locationList] = await Promise.all([
      getAdminCategories(),
      getAdminLocations()
    ])
    categories.value = categoryList
    locations.value = locationList
  } finally {
    loading.value = false
  }
}

function openCategory() {
  categoryForm.name = ''
  categoryForm.sort_order = categories.value.length + 1
  categoryVisible.value = true
}

async function submitCategory() {
  if (!categoryFormRef.value) return
  const valid = await categoryFormRef.value.validate().catch(() => false)
  if (!valid) return
  if (categories.value.some((item) => item.name === categoryForm.name.trim())) {
    ElMessage.warning('该分类名称已存在')
    return
  }
  submitting.value = true
  try {
    await createCategory({
      name: categoryForm.name.trim(),
      sort_order: Number(categoryForm.sort_order) || 0
    })
    ElMessage.success('分类已新增')
    categoryVisible.value = false
    await load()
  } finally {
    submitting.value = false
  }
}

function openLocation() {
  locationForm.name = ''
  locationForm.sort_order = locations.value.length + 1
  locationVisible.value = true
}

async function submitLocation() {
  if (!locationFormRef.value) return
  const valid = await locationFormRef.value.validate().catch(() => false)
  if (!valid) return
  if (locations.value.some((item) => item.name === locationForm.name.trim())) {
    ElMessage.warning('该地点名称已存在')
    return
  }
  submitting.value = true
  try {
    await createLocation({
      name: locationForm.name.trim(),
      sort_order: Number(locationForm.sort_order) || 0
    })
    ElMessage.success('地点已新增')
    locationVisible.value = false
    await load()
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="分类管理"
      description="维护物品分类与校内地点字典，发布表单的下拉项来自这里"
    >
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="按名称过滤"
          clearable
          style="width: 180px"
        />
        <el-button
          :icon="Refresh"
          @click="load"
        >
          刷新
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          @click="openCategory"
        >
          新增分类
        </el-button>
        <el-button
          type="success"
          :icon="Plus"
          @click="openLocation"
        >
          新增地点
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="字典口径"
      description="契约 v1 只提供字典的查询与新增，没有修改 / 删除接口；如需调整请由后端补接口后在此接入。"
      style="margin-bottom: 12px"
    />

    <el-row :gutter="12">
      <el-col :span="12">
        <div
          v-loading="loading"
          class="page-card"
        >
          <div class="card-title">
            物品分类（{{ filteredCategories.length }}）
          </div>
          <el-table
            :data="filteredCategories"
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
              prop="name"
              label="分类名称"
              min-width="140"
            />
            <el-table-column
              prop="sort_order"
              label="排序"
              width="80"
            />
            <template #empty>
              <EmptyState description="暂无分类，先新增一个" />
            </template>
          </el-table>
        </div>
      </el-col>

      <el-col :span="12">
        <div
          v-loading="loading"
          class="page-card"
        >
          <div class="card-title">
            校内地点（{{ filteredLocations.length }}）
          </div>
          <el-table
            :data="filteredLocations"
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
              prop="name"
              label="地点名称"
              min-width="140"
            />
            <el-table-column
              prop="sort_order"
              label="排序"
              width="80"
            />
            <template #empty>
              <EmptyState description="暂无地点，先新增一个" />
            </template>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="categoryVisible"
      title="新增物品分类"
      width="440px"
    >
      <el-form
        ref="categoryFormRef"
        :model="categoryForm"
        :rules="categoryRules"
        label-width="80px"
      >
        <el-form-item
          label="分类名称"
          prop="name"
        >
          <el-input
            v-model="categoryForm.name"
            maxlength="20"
            placeholder="例如：电子产品"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="categoryForm.sort_order"
            :min="0"
            :max="999"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="categoryVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="submitCategory"
        >
          确认新增
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="locationVisible"
      title="新增校内地点"
      width="440px"
    >
      <el-form
        ref="locationFormRef"
        :model="locationForm"
        :rules="locationRules"
        label-width="80px"
      >
        <el-form-item
          label="地点名称"
          prop="name"
        >
          <el-input
            v-model="locationForm.name"
            maxlength="20"
            placeholder="例如：第三教学楼"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number
            v-model="locationForm.sort_order"
            :min="0"
            :max="999"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="locationVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="submitLocation"
        >
          确认新增
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
</style>
