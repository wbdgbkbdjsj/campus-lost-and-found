import type { RouteRecordRaw } from 'vue-router'
import type { MenuItem } from '@/types'
import { ROLE_STUDENT } from '@/utils/constants'

const children: RouteRecordRaw[] = [
  {
    path: 'home',
    name: 'StudentHome',
    component: () => import('@/views/student/home/index.vue'),
    meta: { title: '失物招领大厅', icon: 'Search' }
  },
  {
    path: 'publish',
    name: 'StudentPublish',
    component: () => import('@/views/student/publish/index.vue'),
    meta: { title: '发布信息', icon: 'Plus' }
  },
  {
    path: 'my-items',
    name: 'StudentMyItems',
    component: () => import('@/views/student/my-items/index.vue'),
    meta: { title: '我的发布', icon: 'Document' }
  },
  {
    path: 'detail/:id',
    name: 'StudentItemDetail',
    component: () => import('@/views/student/detail/index.vue'),
    meta: { title: '物品详情', hidden: true }
  },
  {
    path: 'claim-apply/:itemId',
    name: 'StudentClaimApply',
    component: () => import('@/views/student/claim-apply/index.vue'),
    meta: { title: '认领申请', hidden: true }
  },
  {
    path: 'my-claims',
    name: 'StudentMyClaims',
    component: () => import('@/views/student/my-claims/index.vue'),
    meta: { title: '我的申请', icon: 'List' }
  },
  {
    path: 'notices',
    name: 'StudentNotices',
    component: () => import('@/views/student/notices/index.vue'),
    meta: { title: '消息通知', icon: 'Bell' }
  },
  {
    path: 'profile',
    name: 'StudentProfile',
    component: () => import('@/views/student/profile/index.vue'),
    meta: { title: '个人中心', icon: 'User' }
  }
]

/** 菜单由路由表推导，路由一改菜单自动跟随，避免两处维护 */
export const studentMenus: MenuItem[] = children
  .filter((route) => !route.meta?.hidden)
  .map((route) => ({
    path: `/student/${route.path}`,
    title: route.meta?.title ?? '',
    icon: route.meta?.icon
  }))

const studentRoutes: RouteRecordRaw[] = [
  {
    path: '/student',
    component: () => import('@/layouts/StudentLayout.vue'),
    redirect: '/student/home',
    meta: { roles: [ROLE_STUDENT] },
    children
  }
]

export default studentRoutes
