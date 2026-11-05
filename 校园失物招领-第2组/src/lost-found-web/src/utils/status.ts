/**
 * 状态 → 标签颜色 / 文案 的统一映射。
 *
 * 页面不要自己写 `v-if status === 'APPROVED' ? 'success' : 'info'`，
 * 一律调这里，保证三端同一个状态显示同一个颜色。
 * 状态集合的唯一出处：utils/constants.ts（对齐 api-contract-v1.md §5）。
 */

import {
  CLAIM_STATUS,
  CLAIM_STATUS_LABEL,
  FOUND_ITEM_STATUS,
  FOUND_ITEM_STATUS_LABEL,
  LOST_ITEM_STATUS,
  LOST_ITEM_STATUS_LABEL
} from './constants'

/** 与 StatusTag.vue 的 type 入参保持一致 */
export type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

/** 认领单 8 态配色：进行中偏蓝、待补充偏黄、终态按结果分色 */
const CLAIM_TAG: Record<string, TagType> = {
  [CLAIM_STATUS.SUBMITTED]: 'warning',
  [CLAIM_STATUS.UNDER_REVIEW]: 'primary',
  [CLAIM_STATUS.PENDING_INFO]: 'warning',
  [CLAIM_STATUS.APPROVED]: 'success',
  [CLAIM_STATUS.COMPLETED]: 'success',
  [CLAIM_STATUS.REJECTED]: 'danger',
  [CLAIM_STATUS.CANCELLED]: 'info',
  [CLAIM_STATUS.EXPIRED]: 'info'
}

/** 拾获物品 5 态配色 */
const FOUND_TAG: Record<string, TagType> = {
  [FOUND_ITEM_STATUS.REGISTERED]: 'info',
  [FOUND_ITEM_STATUS.CLAIMING]: 'warning',
  [FOUND_ITEM_STATUS.PICKUP_PENDING]: 'primary',
  [FOUND_ITEM_STATUS.CLAIMED]: 'success',
  [FOUND_ITEM_STATUS.CLOSED]: 'info'
}

/** 失物启事 3 态配色 */
const LOST_TAG: Record<string, TagType> = {
  [LOST_ITEM_STATUS.OPEN]: 'warning',
  [LOST_ITEM_STATUS.MATCHED]: 'success',
  [LOST_ITEM_STATUS.CLOSED]: 'info'
}

export function claimTagType(status: string): TagType {
  return CLAIM_TAG[status] ?? 'info'
}

export function foundTagType(status: string): TagType {
  return FOUND_TAG[status] ?? 'info'
}

export function lostTagType(status: string): TagType {
  return LOST_TAG[status] ?? 'info'
}

export function claimStatusText(status: string): string {
  return CLAIM_STATUS_LABEL[status] ?? status
}

export function foundStatusText(status: string): string {
  return FOUND_ITEM_STATUS_LABEL[status] ?? status
}

export function lostStatusText(status: string): string {
  return LOST_ITEM_STATUS_LABEL[status] ?? status
}

/** 按钮显隐的唯一依据：后端返回的 allowed_events，前端不重写状态机 */
export function canDo(allowedEvents: string[] | undefined, action: string): boolean {
  return Array.isArray(allowedEvents) && allowedEvents.includes(action)
}

/** 列表里把「2026-11-05T10:00:00」显示成「2026-11-05 10:00」 */
export function formatTime(value?: string | null): string {
  if (!value) return '-'
  const text = value.replace('T', ' ')
  return text.length >= 16 ? text.slice(0, 16) : text
}
