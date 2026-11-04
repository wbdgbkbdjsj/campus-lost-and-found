# 批次 0｜邓昌兴交付

> 课题：校园失物招领与认领审核系统（第 2 组）
> 阶段：**批次 0（现在开工，不等契约）**
> 交付人：邓昌兴　日期：2026-11-04
> 任务依据：《全员任务总清单-先产出后对接》批次 0

本目录是邓昌兴批次 0 的独立产出，**未改动仓库中其他组员的任何文件**。

---

## 1. 任务对照

| 清单任务 | 产出 | 状态 |
|---|---|---|
| ① 技术选型定死 | `技术选型.md` | ✅ |
| ② 三端工程骨架 + 目录结构 | `lost-found-web/`、`lost-found-server/`、`工程骨架说明.md` | ✅ |
| ③ 页面清单（每端几页、每页干什么） | `页面清单.md` | ✅ |
| ④ 公共组件清单 | `页面清单.md` 第 6 节 | ✅ |

---

## 2. 文件简介

### 文档

| 文件 | 内容简介 |
|---|---|
| `技术选型.md` | 把前后端技术栈**定死**：Vue3 + TypeScript + Vite + Element Plus / Spring Boot 3.2.5 + MyBatis-Plus + Spring Security + JWT + MySQL 8。含版本锁定表、每项选型的理由、明确不用的技术（Redis/Docker/微服务等）、三天风险兜底、变更规则。 |
| `工程骨架说明.md` | 前后端完整目录树与每个目录的职责；三端在单工程里如何隔离（路由前缀 + `meta.roles` + 全局守卫 + 后端 `@PreAuthorize`）；一次请求的完整链路；端口与环境变量；启动步骤；**目录归属边界**（谁改哪些目录）；契约到手后要补的清单。 |
| `页面清单.md` | 三端共 **25 个页面**：学生端 8 页、审核端 6 页、后台端 9 页、公共 2 页。每页写清路由、功能、关键操作、依赖接口、优先级；另有 13 个公共组件清单、页面流转图、P0/P1/P2 裁剪顺序、页面与角色权限矩阵。 |

### 前端工程 `lost-found-web/`

Vue3 + TypeScript 单工程 RBAC 三端骨架，已能安装、构建、启动：

- 三端路由：`/student`、`/audit`、`/admin`，各配独立布局（`layouts/`）
- 路由守卫：未登录跳登录页，角色不符跳回本角色首页（`router/guards.ts`）
- 统一请求封装：自动带 Bearer Token、统一解包 `{code,message,data}`、401 清理登录态（`utils/request.ts`）
- Pinia 登录态、`useTable` 分页封装、全局样式变量
- 23 个业务页面已建占位组件，负责人直接填业务，不用新建文件
- 4 个可直接用的公共组件：`AppLayout`、`PageHeader`、`StatusTag`、`EmptyState`

### 后端工程 `lost-found-server/`

Spring Boot 3.2.5 单体分模块骨架，已通过编译：

- `common/`：统一响应 `Result`、分页 `PageResult`、业务异常、全局异常处理、公共实体基类
- `config/`：Security（JWT 无状态、401/403 JSON、BCrypt）、MyBatis-Plus 分页、静态资源映射、Knife4j 接口文档
- `security/`：JWT 生成/解析、认证过滤器、登录用户快照
- `module/`：auth、user、item、category、claim、audit、notice、file、log、admin 共 10 个业务模块包，每包标注负责人
- `sql/`：建库脚本；建表脚本等契约 v0/v1 定稿后补

---

## 3. 验证记录

| 项 | 结果 |
|---|---|
| `npm install` | ✅ 成功（248 个包） |
| `npx vue-tsc --noEmit` | ✅ 无类型错误 |
| `npm run build` | ✅ 构建成功 |
| `npm run dev` 访问 | ✅ HTTP 200 |
| `mvn -DskipTests compile` | ✅ EXIT=0 |
| 后端连库启动 | ⏳ 未验证（本机无 MySQL，且表结构待契约） |

> 本机没有命令行 Maven/MySQL，编译验证使用临时 Maven 完成；实际开发用 IDEA 内置 Maven 即可。

---

## 4. 与 `api-contract-v1.md` 的差异（合并前必读）

批次 0 开工时契约尚未定稿，本骨架按通用约定搭建。组内契约 v1 出来后，以下 5 处需要对齐，**不要未经调整就直接拿去合并三端代码**：

| # | 本骨架 | 契约 v1 | 影响 |
|---|---|---|---|
| 1 | 角色码 `STUDENT / AUDITOR / ADMIN` | `student / reviewer / super_admin` | 路由 `meta.roles`、JWT 里的 role、`@PreAuthorize` |
| 2 | 成功码 `code = 200` | `code = 0`；错误码 40001/40002/40003/40401/40101 | 前端 `utils/request.ts` 判断、`Result`/`R` |
| 3 | 接口 `/api` + `/items`、`/audit/*` | `/api/v1` + `/found-items`、`/lost-items`、`/claims`、`/review/*` | 所有 `src/api/*.ts` |
| 4 | 包名 `com.campus.lostfound`，公共类 `Result` | 欧阳昊天代码预期 `com.lostfound`、`com.lostfound.common.R` | 后端 import、`@MapperScan` |
| 5 | 未建表，物品/认领为通用模型 | 9 张表：user/category/location/lost_item/found_item/claim/review_record/notification/audit_log | `sql/02-schema.sql`、实体类、前端类型 |

> 对齐由邓昌兴在批次 1 统一完成：先改公共层（包名、`R`、错误码、角色码、API 前缀），再通知三端负责人合并。这样只改一处，避免三个人各改各的。

---

## 5. 本地启动

前端：

```bash
cd lost-found-web
npm install
npm run dev          # http://localhost:5173
```

后端：

1. 执行 `lost-found-server/sql/01-create-database.sql` 建库；
2. 修改 `application-dev.yml` 的数据库账号密码；
3. IDEA 打开 `lost-found-server/pom.xml`，运行 `LostFoundApplication`；
4. 接口文档：http://localhost:8080/api/doc.html
