import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResult } from '@/types'
import { TOKEN_KEY, USER_KEY } from './constants'

/**
 * 统一请求封装。
 * - 自动带 Bearer Token
 * - 统一解包 { code, message, data }，页面直接拿 data
 * - 401 统一清理登录态并回登录页
 */
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
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
      if (body.code !== 200) {
        ElMessage.error(body.message || '请求失败')
        if (body.code === 401) {
          redirectToLogin()
        }
        return Promise.reject(new Error(body.message || '请求失败'))
      }
      return body.data as never
    }
    return response.data as never
  },
  (error) => {
    const status = error?.response?.status
    const message = error?.response?.data?.message || error?.message || '网络异常，请稍后重试'
    if (status === 401) {
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
