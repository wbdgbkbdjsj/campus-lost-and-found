import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { LoginResult, LoginUser } from '@/types'
import { TOKEN_KEY, USER_KEY } from '@/utils/constants'
import { login as loginApi, type LoginPayload } from '@/api/auth'

function readStoredUser(): LoginUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LoginUser
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const user = ref<LoginUser | null>(readStoredUser())

  const isLogin = computed(() => Boolean(token.value))
  const role = computed(() => user.value?.role ?? '')
  const displayName = computed(() => user.value?.name || user.value?.student_no || '未登录')

  async function login(payload: LoginPayload) {
    const result = await loginApi(payload)
    setLoginState(result)
    return result.user
  }

  function setLoginState(result: LoginResult) {
    token.value = result.token
    user.value = result.user
    localStorage.setItem(TOKEN_KEY, result.token)
    localStorage.setItem(USER_KEY, JSON.stringify(result.user))
  }

  /** 原型无 logout 接口，只清理本地登录态 */
  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  return { token, user, isLogin, role, displayName, login, setLoginState, logout }
})
