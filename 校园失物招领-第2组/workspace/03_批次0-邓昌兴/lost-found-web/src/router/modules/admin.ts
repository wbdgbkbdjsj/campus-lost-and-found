import type { RouteRecordRaw } from 'vue-router'
import type { MenuItem } from '@/types'

export const ADMIN_ROLE = 'ADMIN'

const children: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'AdminDashboard',
    component: () => import('@/views/admin/dashboard/index.vue'),
    meta: { title: '数据看板', icon: 'DataAnalysis' }
  },
  {
    path: 'users',
    name: 'AdminUsers',
    component: () => import('@/views/admin/users/index.vue'),
    meta: { title: '用户管理', icon: 'UserFilled' }
  },
  {
    path: 'categories',
    name: 'AdminCategories',
    component: () => import('@/views/admin/categories/index.vue'),
    meta: { title: '分类管理', icon: 'Menu' }
  },
  {
    path: 'items',
    name: 'AdminItems',
    component: () => import('@/views/admin/items/index.vue'),
    meta: { title: '物品管理', icon: 'Box' }
  },
  {
    path: 'claims',
    name: 'AdminClaims',
    component: () => import('@/views/admin/claims/index.vue'),
    meta: { title: '认领管理', icon: 'Tickets' }
  },
  {
    path: 'notices',
    name: 'AdminNotices',
    component: () => import('@/views/admin/notices/index.vue'),
    meta: { title: '公告管理', icon: 'Bell' }
  },
  {
    path: 'logs',
    name: 'AdminLogs',
    component: () => import('@/views/admin/logs/index.vue'),
    meta: { title: '操作日志', icon: 'Files' }
  },
  {
    path: 'settings',
    name: 'AdminSettings',
    component: () => import('@/views/admin/settings/index.vue'),
    meta: { title: '系统设置', icon: 'Setting' }
  },
  {
    path: 'profile',
    name: 'AdminProfile',
    component: () => import('@/views/admin/profile/index.vue'),
    meta: { title: '个人中心', icon: 'User' }
  }
]

export const adminMenus: MenuItem[] = children
  .filter((route) => !route.meta?.hidden)
  .map((route) => ({
    path: `/admin/${route.path}`,
    title: route.meta?.title ?? '',
    icon: route.meta?.icon
  }))

const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/admin/dashboard',
    meta: { roles: [ADMIN_ROLE] },
    children
  }
]

export default adminRoutes
