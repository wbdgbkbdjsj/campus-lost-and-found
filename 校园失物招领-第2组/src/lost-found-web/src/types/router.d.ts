import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，同时用于浏览器标题和菜单文案 */
    title?: string
    /** Element Plus 图标组件名 */
    icon?: string
    /** 允许访问的角色码（契约 v1）：student / reviewer / super_admin */
    roles?: string[]
    /** 白名单页面（登录、404），不需要登录 */
    public?: boolean
    /** 不在侧边菜单显示（详情页、编辑页） */
    hidden?: boolean
  }
}

export {}
