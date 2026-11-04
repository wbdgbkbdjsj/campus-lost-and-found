# 给李子研 / 邓昌兴 的 AI 实现提示词（可直接转发）

> 用途：你（阴亮）把下面两段分别发给李子研、邓昌兴，他们用任意 AI 工具粘贴即可生成 / 改造代码。已对齐 v1 口径（角色 `student/reviewer/super_admin`、9 张表、8 态状态机、I7 不变量）。

---

## 一、给李子研：做「类桌面 AI 工作台」风格 UI 窗口

> 转发给李子研的提示词（直接复制）：

```
你是一个前端开发助手。请基于已有的零构建单页前端（src/lost-found-prototype/web/，已对接 FastAPI 后端）做一个【视觉风格类似桌面 AI 工作台软件】的演示界面。纯 Web 页面，不要用 Electron / 桌面框架。

要求：
1. 布局：左侧导航栏（学生端 / 审核端 / 后台端 三入口切换 + 角色标识）、顶栏（搜索框 + 当前用户）、中间主工作区采用卡片流 / 对话式布局。整体观感参考桌面 AI 助手工作台（侧栏 + 主区 + 顶栏）。
2. 对接现有 FastAPI 后端（已在 127.0.0.1:8000 运行）：登录 POST /auth/login（字段 student_no + password），成功响应 body.code===0；信息流 GET /items、GET /items/{id}、认领 POST /claims、审核 POST /review/claims/{id}/approve、身份核验 POST /review/claims/{id}/verify（APPROVED 自环、不改状态、写 VERIFY 流水）、交接 POST /review/claims/{id}/handover（前置：核验已通过，即 I7 不变量）。
3. 主链必须跑通：登录 → 招领大厅 → 认领申请 → 审核通过 → 身份核验 → 交接。必须能演示「未核验就交接被 40003 拦截」。
4. 界面结构对齐 model/设计模型/10-用户界面模型.md；三角色 student / reviewer / super_admin。
5. 产出：更新后的 web/ 界面 + 6 张界面截图（命名 01-登录页 … 06-VERIFY自环流水），用于演示视频。
6. 不要新增后端接口，只用契约 v1 已有的 30 条。
```

---

## 二、给邓昌兴：让 Vue Web 与后端 / 李的 UI 对接

> 转发给邓昌兴的提示词（直接复制）：

```
你是 Vue3 前端开发助手。请改造工程 lost-found-web（Vue3 + TS + Vite + Element Plus + Pinia）使其与 FastAPI 后端（127.0.0.1:8000）真实对接，并与李子研做的【类 AI 工作台】UI 风格保持一致。

必须改的 8 处（v0 假设 → v1 实际）：
1. vite.config.ts：proxy '/api' → target 'http://127.0.0.1:8000'，rewrite p => p.replace(/^\/api/, '/api/v1')
2. utils/request.ts：成功判断 body.code !== 200 改为 !== 0；未登录码 40101；错误提示优先取 detail
3. utils/constants.ts：角色码 STUDENT / AUDITOR / ADMIN 改为 student / reviewer / super_admin
4. api/auth.ts：登录字段 username 改为 student_no；/auth/profile 改为 /auth/me
5. 路由守卫用 vue-router meta.roles 做三端隔离（不匹配跳各自 ROLE_HOME）
6. 与李子研的 UI 复用同一套布局组件 / 配色（侧栏 + 主区 + 顶栏）
7. 至少把 A 端主链页面（home / detail / publish / claim-apply / my-claims）从占位 EmptyState 改为真实 el-table / el-form
8. 不写假数据，所有内容调真实接口
完成后 npm run build 通过，并与李子研联调截图验证。
```

---

## 三、使用说明（阴亮看）

- 这两段是**给组员的 AI 提示词**，他们粘贴到自己的 AI 工具即可，不用你手把手教。
- 李子研做「AI 工作台风格 UI 外壳」，邓昌兴让 Vue 工程真对接——两人在同一套视觉与接口口径下并行，最后由你整合。
- 风险提示见你问的分工表文件里的红线：别写「从零写了窗口程序」，写「做了类桌面 AI 工作台的 Web 界面」。
