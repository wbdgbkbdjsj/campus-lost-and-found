import request from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'

/**
 * 物品 / 招领信息接口（金道轩负责，路径待契约）
 * TODO(契约 v0)：参数与返回结构待补，页面先用 unknown 顶住
 */
export function pageItems(params: PageQuery) {
  return request.get<PageResult<unknown>>('/items', { params })
}

export function getItem(id: number | string) {
  return request.get<unknown>(`/items/${id}`)
}

export function createItem(data: unknown) {
  return request.post<number>('/items', data)
}

export function updateItem(id: number | string, data: unknown) {
  return request.put<void>(`/items/${id}`, data)
}

export function offlineItem(id: number | string) {
  return request.put<void>(`/items/${id}/offline`)
}

export function pageMyItems(params: PageQuery) {
  return request.get<PageResult<unknown>>('/items/my', { params })
}
