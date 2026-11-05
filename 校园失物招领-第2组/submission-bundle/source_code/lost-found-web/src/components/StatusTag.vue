<script setup lang="ts">
/**
 * 状态徽标：统一三端状态颜色。
 * 状态 → 颜色 的映射等契约 v0 到手后放到 utils/constants.ts，页面只传展示文案和 type。
 */
withDefaults(
  defineProps<{
    text?: string
    type?: 'primary' | 'success' | 'info' | 'warning' | 'danger'
  }>(),
  { text: '-', type: 'info' }
)
</script>

<template>
  <el-tag
    :type="type"
    size="small"
  >
    {{ text }}
  </el-tag>
</template>
