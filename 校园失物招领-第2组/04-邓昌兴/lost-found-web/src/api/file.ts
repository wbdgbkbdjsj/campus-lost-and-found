import request from '@/utils/request'

/**
 * 文件上传接口（邓昌兴负责）
 * 后端本地存储到 ./uploads，返回可直接访问的 URL
 * TODO(契约 v0)：确认返回结构（预计 { url, name }）
 */
export function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<{ url: string; name?: string }>('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
