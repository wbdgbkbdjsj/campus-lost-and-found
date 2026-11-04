import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setupRouterGuards } from './guards'
import commonRoutes from './modules/common'
import studentRoutes from './modules/student'
import auditRoutes from './modules/audit'
import adminRoutes from './modules/admin'

const routes: RouteRecordRaw[] = [
  ...commonRoutes,
  ...studentRoutes,
  ...auditRoutes,
  ...adminRoutes,
  { path: '/:pathMatch(.*)*', redirect: '/404' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

setupRouterGuards(router)

export default router
