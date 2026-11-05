import request from '@/utils/request'
import type { Category, Location } from '@/types'

/**
 * 字典接口（契约 v1 §3.2 #5-#6）。
 * 原型返回数组，不是分页结构，下拉框直接吃。
 */
export function getCategories() {
  return request.get<Category[]>('/dict/categories')
}

export function getLocations() {
  return request.get<Location[]>('/dict/locations')
}
