import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResult } from '@/types'
import { TOKEN_KEY, USER_KEY } from './constants'

/**
 * 统一请求封装（契约 v1）。
 * - 自动带 Bearer Token
 * - 统一解包 { code, message, data }，页面直接拿 data
 * - 成功码是 0（不是 200）
 * - 未登录码 40101（HTTP 401），统一清理登录态并回登录页
 * - 错误提示优先取 detail，回退 message
 */
const SUCCESS_CODE = 0
const UNAUTHORIZED_CODES = new Set([401, 40101])

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000
})

service.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResult<unknown>
    // 兼容文件下载等非标准响应
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== SUCCESS_CODE) {
        const message = body.detail || body.message || '请求失败'
        if (UNAUTHORIZED_CODES.has(body.code)) {
          redirectToLogin()
        } else {
          ElMessage.error(message)
        }
        return Promise.reject(new Error(message))
      }
      return body.data as never
    }
    return response.data as never
  },
  (error) => {
    const status = error?.response?.status
    const data = error?.response?.data as ApiResult<unknown> | undefined
    const message = data?.detail || data?.message || error?.message || '网络异常，请稍后重试'
    if (status === 401 || UNAUTHORIZED_CODES.has(data?.code ?? -1)) {
      redirectToLogin()
    } else {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  }
)

function redirectToLogin() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

/** 让调用方直接拿到 data，而不是 AxiosResponse */
interface RequestClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

export default service as unknown as RequestClient
