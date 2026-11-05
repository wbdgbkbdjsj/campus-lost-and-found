<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import { auditMenus } from '@/router/modules/audit'
</script>

<template>
  <AppLayout
    title="审核端"
    base-path="/audit"
    :menus="auditMenus"
  />
</template>
