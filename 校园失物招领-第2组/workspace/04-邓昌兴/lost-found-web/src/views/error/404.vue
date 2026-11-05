<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="error-page">
    <el-result
      icon="warning"
      title="404"
      sub-title="页面不存在，或当前账号无权访问"
    >
      <template #extra>
        <el-button
          type="primary"
          @click="router.replace('/login')"
        >
          返回登录
        </el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}
</style>
