import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROLE_HOME } from '@/utils/constants'

/**
 * 全局前置守卫：登录校验 + 角色隔离 + 页面标题。
 * 角色码统一取自 utils/constants（student / reviewer / super_admin，契约 v1）。
 * 注意：前端守卫只负责体验，真正的权限边界在后端。
 */
export function setupRouterGuards(router: Router) {
  router.beforeEach((to) => {
    const auth = useAuthStore()

    document.title = to.meta.title
      ? `${to.meta.title} - ${import.meta.env.VITE_APP_TITLE}`
      : import.meta.env.VITE_APP_TITLE

    // 白名单页面（登录、404）
    if (to.meta.public) {
      if (auth.isLogin && to.path === '/login') {
        return ROLE_HOME[auth.role] ?? '/'
      }
      return true
    }

    if (!auth.isLogin) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }

    const roles = to.meta.roles
    if (roles?.length && !roles.includes(auth.role)) {
      return ROLE_HOME[auth.role] ?? '/404'
    }

    return true
  })
}
