<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { ROLE_HOME } from '@/utils/constants'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({
  username: '',
  password: ''
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const user = await auth.login(form)
    ElMessage.success(`欢迎，${user.nickname || user.username}`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    await router.replace(redirect || ROLE_HOME[user.role] || '/404')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card
      class="login-card"
      shadow="always"
    >
      <div class="login-brand">
        <h1>校园失物招领与认领审核系统</h1>
        <p>学生发布 · 审核核验 · 归还闭环</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @keyup.enter="handleLogin"
      >
        <el-form-item
          label="账号"
          prop="username"
        >
          <el-input
            v-model="form.username"
            placeholder="请输入账号"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item
          label="密码"
          prop="password"
        >
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入密码"
            :prefix-icon="Lock"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            class="login-button"
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-tip">
        演示账号待后端用户模块完成后补充
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  background: linear-gradient(135deg, #e8f3ff 0%, #f5f7fa 100%);
}

.login-card {
  width: 420px;
  padding: 8px 12px 4px;
  border-radius: 10px;
}

.login-brand {
  margin-bottom: 20px;
  text-align: center;

  h1 {
    margin: 0;
    font-size: 22px;
    color: #303133;
  }

  p {
    margin: 8px 0 0;
    font-size: 13px;
    color: #909399;
  }
}

.login-button {
  width: 100%;
}

.login-tip {
  font-size: 12px;
  color: #c0c4cc;
  text-align: center;
}
</style>
