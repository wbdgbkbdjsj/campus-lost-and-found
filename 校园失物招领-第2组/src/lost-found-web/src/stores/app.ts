import { ref } from 'vue'
import { defineStore } from 'pinia'

/** 应用级 UI 状态（与业务无关） */
export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { sidebarCollapsed, toggleSidebar }
})
