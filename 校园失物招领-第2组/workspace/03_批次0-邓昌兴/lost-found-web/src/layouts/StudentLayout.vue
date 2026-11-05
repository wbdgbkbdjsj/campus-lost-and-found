<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import { studentMenus } from '@/router/modules/student'
</script>

<template>
  <AppLayout
    title="学生端"
    base-path="/student"
    :menus="studentMenus"
  />
</template>
