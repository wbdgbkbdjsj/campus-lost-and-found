<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { MenuItem } from '@/types'

const props = defineProps<{
  /** 端名称，显示在侧边栏顶部 */
  title: string
  /** 菜单项，由各端路由表推导 */
  menus: MenuItem[]
  /** 本端根路径，用于拼个人中心地址 */
  basePath: string
}>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const activePath = computed(() => route.path)

function onCommand(command: string) {
  if (command === 'logout') {
    auth.logout()
    router.replace('/login')
    return
  }
  if (command === 'profile') {
    router.push(`${props.basePath}/profile`)
  }
}
</script>

<template>
  <el-container class="app-layout">
    <el-aside
      width="220px"
      class="app-aside"
    >
      <div class="app-brand">
        {{ title }}
      </div>
      <el-menu
        :default-active="activePath"
        router
        class="app-menu"
      >
        <el-menu-item
          v-for="menu in menus"
          :key="menu.path"
          :index="menu.path"
        >
          <el-icon v-if="menu.icon">
            <component :is="menu.icon" />
          </el-icon>
          <span>{{ menu.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="app-header">
        <div class="app-header__title">
          {{ route.meta.title }}
        </div>
        <el-dropdown @command="onCommand">
          <span class="app-user">
            <el-icon><UserFilled /></el-icon>
            <span>{{ auth.displayName }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                个人中心
              </el-dropdown-item>
              <el-dropdown-item
                command="logout"
                divided
              >
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped lang="scss">
.app-layout {
  height: 100%;
}

.app-aside {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid #e4e7ed;
}

.app-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  border-bottom: 1px solid #e4e7ed;
}

.app-menu {
  flex: 1;
  border-right: none;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
}

.app-header__title {
  font-size: 16px;
  font-weight: 600;
}

.app-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #606266;
  outline: none;
}

.app-main {
  padding: 0;
  overflow-y: auto;
  background: #f5f7fa;
}
</style>
