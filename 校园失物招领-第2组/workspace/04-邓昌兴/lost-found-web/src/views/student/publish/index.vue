<script setup lang="ts">
/**
 * A3 发布信息（拾获登记 / 失物启事）
 *
 * 两个表单分别对应契约 #8 POST /found-items 与 #10 POST /lost-items。
 * 拾获登记成功后返回 REGISTERED，启事返回 OPEN——状态由后端决定，页面不写死。
 */
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import { createFoundItem, createLostItem } from '@/api/item'
import { getCategories, getLocations } from '@/api/dict'
import type { Category, FoundItemCreate, Location, LostItemCreate } from '@/types'

const router = useRouter()
const activeTab = ref<'found' | 'lost'>('found')
const categories = ref<Category[]>([])
const locations = ref<Location[]>([])
const submitting = ref(false)

const foundFormRef = ref<FormInstance>()
const lostFormRef = ref<FormInstance>()

const foundForm = reactive<FoundItemCreate>({
  title: '',
  category_id: 0,
  description: '',
  found_location: '',
  found_time: '',
  storage_location: '',
  image_url: ''
})

const lostForm = reactive<LostItemCreate>({
  title: '',
  category_id: 0,
  description: '',
  lost_location: '',
  lost_time: ''
})

const commonRules: FormRules = {
  title: [
    { required: true, message: '请填写标题', trigger: 'blur' },
    { min: 2, max: 40, message: '标题长度 2-40 个字符', trigger: 'blur' }
  ],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }]
}

const foundRules: FormRules = {
  ...commonRules,
  found_location: [{ required: true, message: '请填写拾获地点', trigger: 'blur' }]
}

const lostRules: FormRules = {
  ...commonRules,
  lost_location: [{ required: true, message: '请填写丢失地点', trigger: 'blur' }]
}

async function submitFound() {
  if (!foundFormRef.value) return
  const valid = await foundFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const created = await createFoundItem({ ...foundForm })
    ElMessage.success(`已登记，物品编号 #${created.id}`)
    await router.push('/student/my-items')
  } finally {
    submitting.value = false
  }
}

async function submitLost() {
  if (!lostFormRef.value) return
  const valid = await lostFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const created = await createLostItem({ ...lostForm })
    ElMessage.success(`启事已发布，编号 #${created.id}`)
    await router.push('/student/my-items')
  } finally {
    submitting.value = false
  }
}

function resetFound() {
  foundFormRef.value?.resetFields()
}

function resetLost() {
  lostFormRef.value?.resetFields()
}

onMounted(async () => {
  const [categoryList, locationList] = await Promise.all([getCategories(), getLocations()])
  categories.value = categoryList
  locations.value = locationList
})
</script>

<template>
  <div class="page-container">
    <PageHeader
      title="发布信息"
      description="捡到东西做拾获登记，丢了东西发失物启事——两条入口都进同一条认领链路"
    />

    <div class="page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane
          label="拾获登记"
          name="found"
        >
          <el-form
            ref="foundFormRef"
            :model="foundForm"
            :rules="foundRules"
            label-width="100px"
            style="max-width: 640px"
          >
            <el-form-item
              label="物品标题"
              prop="title"
            >
              <el-input
                v-model="foundForm.title"
                placeholder="例如：黑色长柄雨伞"
                maxlength="40"
                show-word-limit
              />
            </el-form-item>

            <el-form-item
              label="分类"
              prop="category_id"
            >
              <el-select
                v-model="foundForm.category_id"
                placeholder="请选择分类"
                style="width: 100%"
              >
                <el-option
                  v-for="item in categories"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              label="拾获地点"
              prop="found_location"
            >
              <el-select
                v-model="foundForm.found_location"
                placeholder="请选择或输入地点"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option
                  v-for="item in locations"
                  :key="item.id"
                  :label="item.name"
                  :value="item.name"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="拾获时间">
              <el-date-picker
                v-model="foundForm.found_time"
                type="datetime"
                placeholder="选择拾获时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item label="存放点">
              <el-input
                v-model="foundForm.storage_location"
                placeholder="例如：失物招领处 B12 柜"
              />
            </el-form-item>

            <el-form-item label="物品描述">
              <el-input
                v-model="foundForm.description"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
                placeholder="外观、颜色、明显磨损等，便于失主认领时比对"
              />
            </el-form-item>

            <el-form-item label="图片地址">
              <el-input
                v-model="foundForm.image_url"
                placeholder="可选，填写可访问的图片链接"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="submitting"
                @click="submitFound"
              >
                提交登记
              </el-button>
              <el-button @click="resetFound">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane
          label="失物启事"
          name="lost"
        >
          <el-form
            ref="lostFormRef"
            :model="lostForm"
            :rules="lostRules"
            label-width="100px"
            style="max-width: 640px"
          >
            <el-form-item
              label="物品标题"
              prop="title"
            >
              <el-input
                v-model="lostForm.title"
                placeholder="例如：丢失一个白色 AirPods 耳机盒"
                maxlength="40"
                show-word-limit
              />
            </el-form-item>

            <el-form-item
              label="分类"
              prop="category_id"
            >
              <el-select
                v-model="lostForm.category_id"
                placeholder="请选择分类"
                style="width: 100%"
              >
                <el-option
                  v-for="item in categories"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              label="丢失地点"
              prop="lost_location"
            >
              <el-select
                v-model="lostForm.lost_location"
                placeholder="请选择或输入地点"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option
                  v-for="item in locations"
                  :key="item.id"
                  :label="item.name"
                  :value="item.name"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="丢失时间">
              <el-date-picker
                v-model="lostForm.lost_time"
                type="datetime"
                placeholder="选择丢失时间"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>

            <el-form-item label="补充说明">
              <el-input
                v-model="lostForm.description"
                type="textarea"
                :rows="3"
                maxlength="200"
                show-word-limit
                placeholder="丢失经过、物品特征等"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="submitting"
                @click="submitLost"
              >
                发布启事
              </el-button>
              <el-button @click="resetLost">
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>
