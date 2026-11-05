/**
 * 站内通知（契约 v1 GET /notifications）
 *
 * 后端只提供「当前登录人收到的通知」一个读接口，无已读回写、无群发公告，
 * 因此页面侧只做展示与前端筛选，不假装有服务端已读状态。
 */

import request from '@/utils/request'
import type { ListResult, Notification } from '@/types'

/** 我的通知列表（按 id 倒序，服务端已排好） */
export function getNotifications() {
  return request.get<ListResult<Notification>>('/notifications')
}
