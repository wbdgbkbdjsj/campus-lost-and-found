/**
 * 业务实体类型 —— 与 api-contract-v1.md §2（9 张表）/ §5（状态机）一一对应。
 *
 * 字段统一使用后端返回的 snake_case，避免页面里再做一层转换。
 * 各端页面不要另建一套实体类型，统一从这里引用。
 */

import type { ClaimStatus } from '@/utils/constants'

// ---------------- 枚举 ----------------

/** 角色码 */
export type Role = 'student' | 'reviewer' | 'super_admin'

/** 账号状态 */
export type UserStatus = 'ACTIVE' | 'DISABLED'

/** 拾获物品状态 */
export type FoundItemStatus = 'REGISTERED' | 'CLAIMING' | 'PICKUP_PENDING' | 'CLAIMED' | 'CLOSED'

/** 失物启事状态 */
export type LostItemStatus = 'OPEN' | 'MATCHED' | 'CLOSED'

/** 审核动作 */
export type ClaimAction =
  | 'SUBMIT'
  | 'ACCEPT'
  | 'VERIFY'
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_INFO'
  | 'RESUBMIT'
  | 'HANDOVER'
  | 'CANCEL'
  | 'EXPIRE'

// ---------------- 9 张表 ----------------

/** user 用户表 */
export interface SysUser {
  id: number
  student_no: string
  name: string
  role: Role
  phone?: string
  status: UserStatus
  created_at?: string
}

/** category 物品分类字典表 */
export interface Category {
  id: number
  name: string
  sort_order?: number
}

/** location 地点字典表 */
export interface Location {
  id: number
  name: string
  sort_order?: number
}

/** lost_item 失物启事表 */
export interface LostItem {
  id: number
  user_id?: number
  title: string
  description: string
  category_id: number
  lost_location: string
  lost_time?: string | null
  status: LostItemStatus
  created_at?: string
}

/** found_item 拾获物品表 */
export interface FoundItem {
  id: number
  finder_id?: number | null
  title: string
  description: string
  category_id: number
  found_location: string
  found_time?: string | null
  image_url?: string
  storage_location?: string
  status: FoundItemStatus
  created_at?: string
}

/** review_record 审核流水 */
export interface ReviewRecord {
  id?: number
  claim_id?: number
  reviewer_id?: number | null
  action: ClaimAction
  from_status?: ClaimStatus | null
  to_status: ClaimStatus
  comment?: string
  created_at?: string | null
}

/** claim 认领申请表（核心实体） */
export interface Claim {
  id: number
  found_item_id: number
  applicant_id: number
  reviewer_id?: number | null
  description: string
  proof: string
  contact: string
  status: ClaimStatus
  status_text: string
  /** 当前状态下允许的事件，按钮显隐直接用它，不要前端重写状态机 */
  allowed_events: ClaimAction[]
  deadline?: string | null
  submitted_at?: string | null
  updated_at?: string | null
}

/** 认领单详情（含完整审核流水） */
export interface ClaimDetail extends Claim {
  records: ReviewRecord[]
}

/** notification 通知表 */
export interface Notification {
  id: number
  user_id?: number
  title: string
  content: string
  is_read: boolean
  created_at?: string | null
}

/** audit_log 操作日志表 */
export interface AuditLog {
  id: number
  actor_id: number
  entity: string
  entity_id: number
  action: string
  detail: string
  created_at?: string | null
}

// ---------------- 请求体 / 视图模型 ----------------

/** 新建拾获登记 */
export interface FoundItemCreate {
  title: string
  category_id: number
  description?: string
  found_location?: string
  found_time?: string | null
  storage_location?: string
  image_url?: string
}

/** 新建失物启事 */
export interface LostItemCreate {
  title: string
  category_id: number
  description?: string
  lost_location?: string
  lost_time?: string | null
}

/** 提交认领申请（proof 必填，是防冒领第一道校验） */
export interface ClaimCreate {
  found_item_id: number
  proof: string
  description?: string
  contact?: string
}

/** 身份核验请求（#19，APPROVED 自环，不改状态） */
export interface VerifyPayload {
  student_no: string
  name: string
}

/** 审核动作请求体（驳回 / 退回补充的 comment 必填） */
export interface ActionPayload {
  comment?: string
}

/** 审核队列项（GET /review/queue） */
export interface ReviewQueueItem extends Claim {
  waiting_minutes: number
  applicant: string
  title: string
}

/** 统计看板（GET /admin/stats/overview） */
export interface StatsOverview {
  users: {
    total: number
    student: number
    reviewer: number
    admin: number
    disabled: number
  }
  items: {
    found_total: number
    lost_total: number
    found_claimed: number
    found_registered: number
  }
  claims: {
    total: number
    by_status: Partial<Record<ClaimStatus, number>>
    completed: number
    expired: number
    pending: number
  }
  rates: {
    completion_rate: number
    timeout_rate: number
    avg_review_minutes: number
  }
  audit_total: number
}
