<script setup lang="ts">
/**
 * A2 物品详情
 * 数据源 GET /found-items/{id}；状态非 REGISTERED / CLAIMING 时不允许发起认领，
 * 与后端 service.create_claim 的状态前置校验保持一致。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { getFoundItem } from '@/api/item'
import { getCategories } from '@/api/dict'
import type { Category, FoundItem } from '@/types'
import { formatTime, foundStatusText, foundTagType } from '@/utils/status'

const route = useRoute()
const router = useRouter()

const item = ref<FoundItem | null>(null)
const categories = ref<Category[]>([])
const loading = ref(false)

const categoryName = computed(() => {
  const hit = categories.value.find((one) => one.id === item.value?.category_id)
  return hit ? hit.name : '-'
})

const claimable = computed(() => {
  const status = item.value?.status
  return status === 'REGISTERED' || status === 'CLAIMING'
})

async function load() {
  const id = route.params.id as string
  loading.value = true
  try {
    const [detail, categoryList] = await Promise.all([getFoundItem(id), getCategories()])
    item.value = detail
    categories.value = categoryList
  } finally {
    loading.value = false
  }
}

function goClaim() {
  if (!item.value) return
  router.push(`/student/claim-apply/${item.value.id}`)
}

function goBack() {
  router.back()
}

onMounted(load)
</script>

<template>
  <div
    v-loading="loading"
    class="page-container"
  >
    <PageHeader
      title="物品详情"
      description="提交认领申请前，请先确认这件物品的关键特征你都能描述清楚"
    >
      <template #extra>
        <el-button @click="goBack">
          返回列表
        </el-button>
        <el-button
          type="primary"
          :disabled="!claimable"
          @click="goClaim"
        >
          我要认领
        </el-button>
      </template>
    </PageHeader>

    <div
      v-if="item"
      class="page-card"
    >
      <div class="detail-head">
        <h3 class="detail-title">
          {{ item.title }}
        </h3>
        <StatusTag
          :text="foundStatusText(item.status)"
          :type="foundTagType(item.status)"
        />
      </div>

      <el-descriptions
        :column="2"
        border
      >
        <el-descriptions-item label="物品分类">
          {{ categoryName }}
        </el-descriptions-item>
        <el-descriptions-item label="拾获地点">
          {{ item.found_location || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="拾获时间">
          {{ formatTime(item.found_time) }}
        </el-descriptions-item>
        <el-descriptions-item label="存放点">
          {{ item.storage_location || '未登记' }}
        </el-descriptions-item>
        <el-descriptions-item
          label="物品描述"
          :span="2"
        >
          {{ item.description || '暂无补充描述' }}
        </el-descriptions-item>
      </el-descriptions>

      <div
        v-if="item.image_url"
        class="detail-image"
      >
        <el-image
          :src="item.image_url"
          fit="contain"
          style="max-width: 420px"
        />
      </div>

      <el-alert
        v-if="!claimable"
        class="detail-tip"
        type="info"
        :closable="false"
        show-icon
        title="该物品当前不可认领"
        description="只有当物品处于「已登记」或「认领中」状态时才能提交认领申请。"
      />
    </div>

    <el-empty
      v-else-if="!loading"
      description="没有找到这件物品，可能已被删除"
    />
  </div>
</template>

<style scoped lang="scss">
.detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.detail-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.detail-image {
  margin-top: 16px;
}

.detail-tip {
  margin-top: 16px;
}
</style>
