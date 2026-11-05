import type { RouteRecordRaw } from 'vue-router'
import type { MenuItem } from '@/types'
import { ROLE_REVIEWER } from '@/utils/constants'

const children: RouteRecordRaw[] = [
  {
    path: 'workbench',
    name: 'AuditWorkbench',
    component: () => import('@/views/audit/workbench/index.vue'),
    meta: { title: '审核工作台', icon: 'DataAnalysis' }
  },
  {
    path: 'publish-review',
    name: 'AuditPublishReview',
    component: () => import('@/views/audit/publish-review/index.vue'),
    meta: { title: '发布审核', icon: 'DocumentChecked' }
  },
  {
    path: 'claim-review',
    name: 'AuditClaimReview',
    component: () => import('@/views/audit/claim-review/index.vue'),
    meta: { title: '认领审核', icon: 'Checked' }
  },
  {
    path: 'return-register',
    name: 'AuditReturnRegister',
    component: () => import('@/views/audit/return-register/index.vue'),
    meta: { title: '归还登记', icon: 'RefreshLeft' }
  },
  {
    path: 'records',
    name: 'AuditRecords',
    component: () => import('@/views/audit/records/index.vue'),
    meta: { title: '审核记录', icon: 'Tickets' }
  },
  {
    path: 'profile',
    name: 'AuditProfile',
    component: () => import('@/views/audit/profile/index.vue'),
    meta: { title: '个人中心', icon: 'User' }
  }
]

export const auditMenus: MenuItem[] = children
  .filter((route) => !route.meta?.hidden)
  .map((route) => ({
    path: `/audit/${route.path}`,
    title: route.meta?.title ?? '',
    icon: route.meta?.icon
  }))

const auditRoutes: RouteRecordRaw[] = [
  {
    path: '/audit',
    component: () => import('@/layouts/AuditLayout.vue'),
    redirect: '/audit/workbench',
    meta: { roles: [ROLE_REVIEWER] },
    children
  }
]

export default auditRoutes
