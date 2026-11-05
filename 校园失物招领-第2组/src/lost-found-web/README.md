# lost-found-web｜校园失物招领前端（单工程 RBAC 三端）

## 启动

```bash
cd lost-found-web
npm install
npm run dev
```

打开 http://localhost:5173 ，默认跳转 `/login`。

## 目录

```
src/
├─ api/          接口封装（按业务模块，页面不直接写 axios）
├─ components/   公共组件（AppLayout / PageHeader / StatusTag / EmptyState）
├─ composables/  组合式函数（useTable 分页封装）
├─ layouts/      三端布局（StudentLayout / AuditLayout / AdminLayout）
├─ router/       路由（modules 下按端拆分）
├─ stores/       Pinia（auth 登录态、app UI 状态）
├─ styles/       全局样式与变量
├─ types/        全局类型（实体类型等契约 v0 后补）
├─ utils/        request / constants / format
└─ views/        页面（student / audit / admin / login / error）
```

## 三端

| 端 | 前缀 | 角色 | 负责人 |
|---|---|---|---|
| 学生端 | `/student` | STUDENT | 金道轩 |
| 审核端 | `/audit` | AUDITOR | 李子研 |
| 后台端 | `/admin` | ADMIN | 欧阳昊天 |
| 公共层 | `/login` | — | 邓昌兴 |

## 约定

- 所有页面的接口字段以李子研《api-contract-v0.md》为准，先改 `src/types/business.ts`，再改页面。
- 只改自己负责的目录，公共组件改动找邓昌兴。
- 提交前跑 `npm run lint` 与 `npm run build`（含 vue-tsc 类型检查）。

> 当前为批次 0 骨架：页面均为占位，业务代码批次 1 填充。
