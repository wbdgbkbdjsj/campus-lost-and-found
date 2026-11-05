/** 侧边菜单项（由路由表推导） */
export interface MenuItem {
  path: string
  title: string
  icon?: string
}

/** 登录用户（字段以契约定稿为准，先保留最小集） */
export interface LoginUser {
  id: number
  username: string
  nickname: string
  role: string
  avatar?: string
}

/** 登录返回 */
export interface LoginResult {
  token: string
  user: LoginUser
}

/** 后端统一响应：{ code, message, data } */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页结果 */
export interface PageResult<T> {
  records: T[]
  total: number
  current: number
  size: number
}

/** 分页查询参数基类 */
export interface PageQuery {
  current?: number
  size?: number
  [key: string]: unknown
}

export * from './business'
