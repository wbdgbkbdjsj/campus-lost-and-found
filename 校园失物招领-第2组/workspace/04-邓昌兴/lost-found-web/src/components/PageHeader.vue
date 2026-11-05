<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="page-header">
    <div class="page-header__main">
      <h2 class="page-header__title">
        {{ title }}
      </h2>
      <p
        v-if="description"
        class="page-header__desc"
      >
        {{ description }}
      </p>
    </div>
    <div class="page-header__extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.page-header__desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: #909399;
}

.page-header__extra {
  display: flex;
  gap: 8px;
}
</style>
