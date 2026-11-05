<script setup lang="ts">
/**
 * A5 提交认领申请
 *
 * 对应契约 #12 POST /claims。proof（物品特征自证）为必填，是防冒领的第一道校验，
 * 后端 service.create_claim 还会校验物品状态必须是 REGISTERED / CLAIMING、且本人无在途申请。
 * 页面把这两条前置条件在提交前先做一次友好提示，不做重复的业务判断。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { createClaim } from '@/api/claim'
import { getFoundItem } from '@/api/item'
import { getCategories } from '@/api/dict'
import { useAuthStore } from '@/stores/auth'
import type { Category, ClaimCreate, FoundItem } from '@/types'
import { formatTime, foundStatusText, foundTagType } from '@/utils/status'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const itemId = Number(route.params.itemId)
const item = ref<FoundItem | null>(null)
const categories = ref<Category[]>([])
const loading = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

/** contact 默认带出手机号（后端 user 表有 phone 字段，登录态里没带，留空由用户填） */
const form = reactive<ClaimCreate>({
  found_item_id: itemId,
  proof: '',
  description: '',
  contact: ''
})

const rules: FormRules = {
  proof: [
    { required: true, message: '请描述只有失主才知道的物品特征', trigger: 'blur' },
    { min: 10, max: 300, message: '特征描述 10-300 个字符', trigger: 'blur' }
  ],
  description: [{ max: 300, message: '补充说明不超过 300 个字符', trigger: 'blur' }],
  contact: [
    { required: true, message: '请填写联系方式，便于审核员联系交接', trigger: 'blur' },
    { min: 5, max: 40, message: '联系方式 5-40 个字符', trigger: 'blur' }
  ]
}

const categoryName = computed(() => {
  const hit = categories.value.find((one) => one.id === item.value?.category_id)
  return hit ? hit.name : '-'
})

/** 与后端前置校验对齐：只有 REGISTERED / CLAIMING 的物品可以发起认领 */
const claimable = computed(() => {
  const status = item.value?.status
  return status === 'REGISTERED' || status === 'CLAIMING'
})

async function load() {
  loading.value = true
  try {
    const [detail, categoryList] = await Promise.all([getFoundItem(itemId), getCategories()])
    item.value = detail
    categories.value = categoryList
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const claim = await createClaim({
      found_item_id: itemId,
      proof: form.proof.trim(),
      description: form.description?.trim() || undefined,
      contact: form.contact?.trim() || undefined
    })
    ElMessage.success(`认领申请已提交，单号 #${claim.id}，当前状态：${claim.status_text}`)
    router.replace('/student/my-claims')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!Number.isFinite(itemId) || itemId <= 0) {
    ElMessage.error('物品编号无效，无法发起认领')
    router.replace('/student/home')
    return
  }
  await load()
})
</script>

<template>
  <div
    v-loading="loading"
    class="page-container"
  >
    <PageHeader
      title="提交认领申请"
      description="描述只有失主才知道的细节，审核员会据此比对核验"
    >
      <template #extra>
        <el-button @click="router.back()">
          返回
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="item && !claimable"
      type="warning"
      :closable="false"
      show-icon
      :title="`该物品当前状态为「${foundStatusText(item.status)}」，已不能发起新的认领申请`"
      description="仅「已登记」与「认领中」的物品接受认领申请，请返回大厅选择其他物品。"
      style="margin-bottom: 12px"
    />

    <el-row :gutter="12">
      <el-col :span="9">
        <div class="page-card">
          <div class="card-title">
            物品信息
          </div>
          <el-descriptions
            :column="1"
            border
            size="small"
          >
            <el-descriptions-item label="物品标题">
              {{ item?.title || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="分类">
              {{ categoryName }}
            </el-descriptions-item>
            <el-descriptions-item label="拾获地点">
              {{ item?.found_location || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="拾获时间">
              {{ formatTime(item?.found_time) }}
            </el-descriptions-item>
            <el-descriptions-item label="存放点">
              {{ item?.storage_location || '未登记' }}
            </el-descriptions-item>
            <el-descriptions-item label="当前状态">
              <StatusTag
                v-if="item"
                :text="foundStatusText(item.status)"
                :type="foundTagType(item.status)"
              />
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="登记描述">
              {{ item?.description || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>

      <el-col :span="15">
        <div class="page-card">
          <div class="card-title">
            认领材料
          </div>
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-width="100px"
            :disabled="!claimable"
          >
            <el-form-item
              label="自证特征"
              prop="proof"
            >
              <el-input
                v-model="form.proof"
                type="textarea"
                :rows="5"
                maxlength="300"
                show-word-limit
                placeholder="例如：黑色自动伞，伞柄有一道划痕，伞骨第二节贴了蓝色贴纸"
              />
              <div class="field-tip">
                不要只写「是我的」——审核员会按你描述的特征与实物比对，写错会被驳回。
              </div>
            </el-form-item>

            <el-form-item
              label="补充说明"
              prop="description"
            >
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="3"
                maxlength="300"
                show-word-limit
                placeholder="丢失时间、丢失经过等（选填）"
              />
            </el-form-item>

            <el-form-item
              label="联系方式"
              prop="contact"
            >
              <el-input
                v-model="form.contact"
                maxlength="40"
                placeholder="手机号或微信号，供审核员约交接"
                style="width: 280px"
              />
            </el-form-item>

            <el-form-item label="申请人">
              <span class="readonly-text">
                {{ auth.displayName }}（{{ auth.user?.student_no || '-' }}）
              </span>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                :loading="submitting"
                :disabled="!claimable"
                @click="submit"
              >
                提交申请
              </el-button>
              <el-button @click="router.push('/student/my-claims')">
                查看我的申请
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.card-title {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.field-tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #909399;
}

.readonly-text {
  font-size: 13px;
  color: #606266;
}
</style>
