<script setup lang="ts">
withDefaults(
  defineProps<{
    description?: string
  }>(),
  { description: '暂无数据' }
)
</script>

<template>
  <el-empty :description="description">
    <slot name="action" />
  </el-empty>
</template>
