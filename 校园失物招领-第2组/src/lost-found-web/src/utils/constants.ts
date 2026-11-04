/** 角色码（与后端 role.code 保持一致） */
export const ROLE_STUDENT = 'STUDENT'
export const ROLE_AUDITOR = 'AUDITOR'
export const ROLE_ADMIN = 'ADMIN'

/** 角色 → 登录后首页 */
export const ROLE_HOME: Record<string, string> = {
  [ROLE_STUDENT]: '/student/home',
  [ROLE_AUDITOR]: '/audit/workbench',
  [ROLE_ADMIN]: '/admin/dashboard'
}

/** 角色 → 中文名 */
export const ROLE_LABEL: Record<string, string> = {
  [ROLE_STUDENT]: '学生',
  [ROLE_AUDITOR]: '审核员',
  [ROLE_ADMIN]: '管理员'
}

/**
 * TODO(契约 v0)：物品类型、物品状态、认领状态等枚举，
 * 等《api-contract-v0.md》定稿后统一补到本文件，页面不要自己写魔法值。
 */

/** 本地存储键 */
export const TOKEN_KEY = 'lf_token'
export const USER_KEY = 'lf_user'
