<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import { adminMenus } from '@/router/modules/admin'
</script>

<template>
  <AppLayout
    title="后台端"
    base-path="/admin"
    :menus="adminMenus"
  />
</template>
