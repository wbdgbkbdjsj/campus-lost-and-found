/** 侧边菜单项（由路由表推导） */
export interface MenuItem {
  path: string
  title: string
  icon?: string
}

/** 登录用户（契约 v1：user 表字段） */
export interface LoginUser {
  id: number
  student_no: string
  name: string
  role: string
}

/** 登录返回 */
export interface LoginResult {
  token: string
  user: LoginUser
}

/** 后端统一响应：{ code, message, data }，失败时可能带 detail */
export interface ApiResult<T = unknown> {
  code: number
  message: string
  data: T
  detail?: string
}

/** 列表结果（FastAPI 原型统一返回 { total, items }） */
export interface ListResult<T> {
  total: number
  items: T[]
}

/** 分页 / 查询参数（后端使用 page、size，从 1 开始） */
export interface PageQuery {
  page?: number
  size?: number
  keyword?: string
  [key: string]: unknown
}

export * from './business'
