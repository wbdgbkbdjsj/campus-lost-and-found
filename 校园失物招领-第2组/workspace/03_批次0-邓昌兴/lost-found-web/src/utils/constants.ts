/**
 * 全局常量（契约 v1 口径）。
 * 唯一出处：02-李子研/api-contract-v1.md
 */

/** 角色码：student / reviewer / super_admin（admin、user、auditor 已废弃） */
export const ROLE_STUDENT = 'student'
export const ROLE_REVIEWER = 'reviewer'
export const ROLE_SUPER_ADMIN = 'super_admin'

/** 角色 → 登录后首页 */
export const ROLE_HOME: Record<string, string> = {
  [ROLE_STUDENT]: '/student/home',
  [ROLE_REVIEWER]: '/audit/workbench',
  [ROLE_SUPER_ADMIN]: '/admin/dashboard'
}

/** 角色 → 中文名 */
export const ROLE_LABEL: Record<string, string> = {
  [ROLE_STUDENT]: '学生',
  [ROLE_REVIEWER]: '审核员',
  [ROLE_SUPER_ADMIN]: '超级管理员'
}

/** 认领单状态（8 态，4 个终态） */
export const CLAIM_STATUS = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  PENDING_INFO: 'PENDING_INFO',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED'
} as const

export type ClaimStatus = (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS]

export const CLAIM_STATUS_LABEL: Record<string, string> = {
  [CLAIM_STATUS.SUBMITTED]: '待审核',
  [CLAIM_STATUS.UNDER_REVIEW]: '审核中',
  [CLAIM_STATUS.PENDING_INFO]: '待补充材料',
  [CLAIM_STATUS.APPROVED]: '审核通过·待领取',
  [CLAIM_STATUS.REJECTED]: '已驳回',
  [CLAIM_STATUS.CANCELLED]: '已撤销',
  [CLAIM_STATUS.COMPLETED]: '已完成',
  [CLAIM_STATUS.EXPIRED]: '已失效'
}

/** 认领单终态：无出边 */
export const CLAIM_TERMINAL_STATUS: string[] = [
  CLAIM_STATUS.REJECTED,
  CLAIM_STATUS.CANCELLED,
  CLAIM_STATUS.COMPLETED,
  CLAIM_STATUS.EXPIRED
]

/** 状态机事件（按钮显隐一律用后端返回的 allowed_events，不要前端硬编码） */
export const CLAIM_ACTION = {
  SUBMIT: 'SUBMIT',
  ACCEPT: 'ACCEPT',
  VERIFY: 'VERIFY',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  REQUEST_INFO: 'REQUEST_INFO',
  RESUBMIT: 'RESUBMIT',
  HANDOVER: 'HANDOVER',
  CANCEL: 'CANCEL',
  EXPIRE: 'EXPIRE'
} as const

export const CLAIM_ACTION_LABEL: Record<string, string> = {
  [CLAIM_ACTION.ACCEPT]: '接单',
  [CLAIM_ACTION.VERIFY]: '身份核验',
  [CLAIM_ACTION.APPROVE]: '审核通过',
  [CLAIM_ACTION.REJECT]: '驳回',
  [CLAIM_ACTION.REQUEST_INFO]: '退回补充',
  [CLAIM_ACTION.RESUBMIT]: '补充材料',
  [CLAIM_ACTION.HANDOVER]: '确认交接',
  [CLAIM_ACTION.CANCEL]: '撤销',
  [CLAIM_ACTION.EXPIRE]: '超时失效'
}

/** 拾获物品状态（5 态） */
export const FOUND_ITEM_STATUS = {
  REGISTERED: 'REGISTERED',
  CLAIMING: 'CLAIMING',
  PICKUP_PENDING: 'PICKUP_PENDING',
  CLAIMED: 'CLAIMED',
  CLOSED: 'CLOSED'
} as const

export const FOUND_ITEM_STATUS_LABEL: Record<string, string> = {
  [FOUND_ITEM_STATUS.REGISTERED]: '已登记',
  [FOUND_ITEM_STATUS.CLAIMING]: '认领中',
  [FOUND_ITEM_STATUS.PICKUP_PENDING]: '待领取',
  [FOUND_ITEM_STATUS.CLAIMED]: '已认领',
  [FOUND_ITEM_STATUS.CLOSED]: '已关闭'
}

/** 失物启事状态（3 态） */
export const LOST_ITEM_STATUS = {
  OPEN: 'OPEN',
  MATCHED: 'MATCHED',
  CLOSED: 'CLOSED'
} as const

export const LOST_ITEM_STATUS_LABEL: Record<string, string> = {
  [LOST_ITEM_STATUS.OPEN]: '寻找中',
  [LOST_ITEM_STATUS.MATCHED]: '已匹配',
  [LOST_ITEM_STATUS.CLOSED]: '已关闭'
}

/** 错误码（契约 v1 §6） */
export const ERROR_CODE = {
  ILLEGAL_TRANSITION: 40001,
  FORBIDDEN: 40002,
  VALIDATION_ERROR: 40003,
  NOT_FOUND: 40401,
  UNAUTHORIZED: 40101
} as const

/** 本地存储键 */
export const TOKEN_KEY = 'lf_token'
export const USER_KEY = 'lf_user'
