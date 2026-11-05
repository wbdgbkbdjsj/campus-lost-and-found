# 设计说明书 — 校园失物招领与认领审核系统（全系统）v2.0

| 项目 | 内容 |
|---|---|
| 文档编号 | doc/02 |
| 版本 | v2.0（全系统设计）　取代 v1.1（B 端审核模块专项） |
| 编写 | 李子研（v1.0 / v1.1 总体设计、数据库、状态机、B 端模块）；金道轩（v2.0 按 src 实际实现扩写为全系统） |
| 日期 | 2026-11-06 |
| 依据 | `doc/12-接口契约-v1.md`（已冻结）、`doc/01-软件需求规格说明书.md`、`doc/03-总体设计报告.md`、`src/` 三块源码 |
| 读者 | 全组开发、答辩评审、验收老师 |

**v2.0 变更摘要**

1. **范围从「B 端审核模块」扩为「全系统三端」**，补齐 A 端（学生）与 C 端（后台）的详细设计。
2. **全部设计结论回填代码落点**，逐条给出 `文件:行号`，设计不再悬空于文档。
3. 修正 v1.1 的三处事实错误：①把可运行参考实现称作 `server/`（实为 `lost-found-prototype/`，`lost-found-server/` 是 Spring Boot 骨架）；②写「C 端接口未含」，实际原型已实现 #25–#30；③写「契约 #1–24 已实现」，实际 #1 注册未实现。
4. 新增 §7.6 已知偏差清单、§9 关键流程时序、§10 接口设计规范、§11 可测试性设计、§12 需求追溯。
5. §2、§4、§5、§6、§7、§8 的编号与语义**保持不变**，`doc/13-需求-设计对照表.md` 的章节引用继续有效。

---

## 1 引言

### 1.1 编写目的

把《需求规格说明书》的 20 条功能需求，翻译成可直接施工的设计：**分层怎么切、状态怎么管、数据怎么存、接口怎么约定、异常怎么收敛**。本文档是编码、评审与验收的共同基准：凡是文档与代码不一致的地方，一律以「§7.6 已知偏差」显式登记，不允许两边各说一套。

### 1.2 设计范围

| 在范围内 | 不在范围内 |
|---|---|
| 三端（学生 / 审核员 / 超级管理员）的功能结构、数据、接口、状态机设计 | 校园统一身份认证（CAS）对接 |
| 前端工程结构、路由与权限、请求封装、页面与接口映射 | 移动端 App / 小程序 |
| 与实现对齐的数据库表结构、索引、外键 | 短信 / 邮件网关（站内通知代替） |
| 错误码体系、鉴权与越权边界、超时收敛策略 | 分布式部署、读写分离、缓存中间件 |

### 1.3 术语与参考

术语以 `doc/10-术语表-v1.md` 为准，本文只用其中已冻结的词：**认领单（claim）、审核流水（review_record）、不变量（I1–I7）、allowed_events、双轨（方案 C）**。角色码固定为 `student` / `reviewer` / `super_admin`（v1 起 `admin`、`user`、`auditor` 全部废弃）。

### 1.4 系统概述

系统解决校园失物招领中「认领无凭证、审核无流程、交接无记录」的问题。核心是一条**认领单审核状态流**：申请人提交凭证 → 审核员接单审核（可退回补充）→ 通过后现场身份核验 → 交接确认闭环，全程留痕可追溯。

| 端 | 用户 | 核心功能 | 页面数 |
|---|---|---|---|
| A 端 | 学生（student） | 大厅检索、拾获登记、失物启事、认领申请、补充材料、我的申请、通知 | 8 |
| B 端 | 审核员（reviewer） | 审核队列、接单、身份核验、通过/驳回/退补、交接登记、流水追溯 | 6 |
| C 端 | 超级管理员（super_admin） | 用户管理、字典维护、物品与认领总览、统计看板、日志查询、CSV 导出 | 9 |

### 1.5 代码实体与文档的映射

`src/` 是唯一正式提交视图，由 `同步提交视图.py` 从 `workspace/` 过程目录幂等复制而来（改原件后重跑脚本，避免复制品漂移）。三块源码的真实定位如下：

| 目录 | 技术栈 | 规模 | 定位与完成度 |
|---|---|---|---|
| `src/lost-found-prototype/` | FastAPI + SQLAlchemy + SQLite | 6 个 .py，1 340 行 | **可运行参考实现**：32 个路由全部可跑，24 项冒烟全绿；含演示用静态前端 `web/`（同源托管，零 CORS） |
| `src/lost-found-web/` | Vue 3.5 + TypeScript + Element Plus + Pinia + Vite 5 | 33 个 .vue 共 9 122 行；含 ts/scss 合计 10 518 行 | **正式前端**：三端 23 个业务页面全部实现，接通 `/api/v1` |
| `src/lost-found-server/` | Spring Boot 3.2.5 + Java 17 + MyBatis-Plus 3.5.7 + Spring Security 6 + JWT + MySQL 8 | 24 个 .java（其中 10 个 `package-info.java` 占位）+ pom，600 行 | **后端骨架**：分层目录、统一响应/异常/分页、JWT 过滤器、安全配置就位；业务模块仅占位包，建表脚本仅建库 |

> 设计口径：**正式技术栈按全组约定（Vue3 + Spring Boot + MySQL）**；FastAPI 原型是「行为基准 + 演示保底」——它把本文档所有状态机与接口约定跑通了一遍，Spring Boot 实现照此翻译即可（映射见附录 A）。凡本文写「已实现」，指三块 src 中至少一处可运行代码成立。

---

## 2 总体架构

### 2.1 逻辑架构

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ A端 Vue3 │  │ B端 Vue3 │  │ C端 Vue3 │      ← 三角色三入口，同一前端工程按路由分流
└────┬─────┘  └────┬─────┘  └────┬─────┘
     └────── Nginx 反向代理 / Vite dev proxy ──────┘
┌────────────────────────────────────────────────┐
│  Spring Boot 单体（按包分构件，context-path=/api）│
│  Controller：Auth/Item/Claim/Review/Admin       │
│  Service：事务边界 + 伴随动作                    │
│  ★ StateMachine 构件（唯一迁移裁决点）           │
│  Mapper（MyBatis-Plus，9 张表）                  │
├────────────────────────────────────────────────┤
│  MySQL 8.0 ｜ 本地文件存储 ｜ @Scheduled 超时批处理│
└────────────────────────────────────────────────┘
```

依赖方向是单向的：`Controller → Service → StateMachine → Mapper`，**反向依赖一律禁止**。`StateMachine` 是纯逻辑构件，不持有数据库会话，因此可以被单元测试独立覆盖（原型 `state_machine.py` 即是不 import 数据库的实现）。

### 2.2 双轨实现与完成度

| 层次 | 正式方案 | 参考实现（可运行） | 一致性 |
|---|---|---|---|
| 表现层 | `lost-found-web`（Vue3 + TS + Element Plus） | 原型 `web/app.js`（原生 JS 单页，60 KB） | 前端只认 `/api/v1` 与 `{code,message,data}`，两者可互换 |
| 控制层 | `lost-found-server` Controller（待实现） | `main.py` 32 个路由 | 路由、请求体、返回体逐条对齐契约 |
| 领域层 | Service + state-machine 构件（待实现） | `service.py` 246 行 + `state_machine.py` 123 行 | 迁移表、不变量、伴随动作完全一致 |
| 持久层 | MyBatis-Plus + MySQL 8 | SQLAlchemy + SQLite（开启 `PRAGMA foreign_keys=ON`） | 表名、字段名、外键同构，仅类型方言不同 |

### 2.3 后端分层职责（硬约束）

| 层 | 只做 | 绝不做 | 落点 |
|---|---|---|---|
| Controller | 参数校验（Pydantic / `@Valid`）、取当前用户、调 Service、包装响应 | 不写业务判断，不改实体状态 | `main.py:191-560` |
| Service | 事务边界、越权校验、伴随动作（物品状态 / 通知 / 审计 / 流水） | 不自己判定「这个事件合不合法」 | `service.py:97-246` |
| StateMachine | 迁移裁决、`allowed_events` 计算、抛领域异常 | 不碰数据库、不发通知 | `state_machine.py:89-123` |
| Mapper / ORM | 单表增删改查、索引命中 | 不写跨表业务 | `models.py:35-142` |

**唯一写状态入口**：全仓库只有 `service._persist()` 一处修改 `claim.status`（`service.py:29-40`），其余代码一律经它落库，因此「状态被绕过」在机制上不可能发生（对应非功能项 N1）。

### 2.4 前端架构

| 关注点 | 实现方式 | 落点 |
|---|---|---|
| 路由 | 按端拆模块 `modules/{student,audit,admin,common}.ts`，菜单由路由表推导（改路由菜单自动跟随，避免两处维护） | `router/index.ts`、`router/modules/*` |
| 权限 | 全局前置守卫三重判定：公开页白名单 → 未登录跳登录（带 `redirect`）→ `meta.roles` 不匹配则跳本人首页 | `router/guards.ts` |
| 状态 | Pinia，仅 `auth`（token + user，持久化到 localStorage）与 `app`（侧栏折叠等 UI 态） | `stores/auth.ts` |
| 请求 | axios 单实例：自动加 `Authorization: Bearer`、统一解包 `{code,message,data}`、成功码 `0`、`40101` 清登录态并跳登录 | `utils/request.ts` |
| 列表 | `useTable()` 组合函数封装 `page/size + {total,items}` 分页，页面只提供 fetcher | `composables/useTable.ts` |
| 展示约定 | 状态→颜色、状态→中文、`allowed_events`→按钮显隐，三端共用一套映射 | `utils/status.ts`、`components/StatusTag.vue` |
| 布局 | 三端各一套 Layout（侧边菜单 + 顶栏 + 内容区），`AppLayout` 提供共用骨架 | `layouts/*`、`components/AppLayout.vue` |

### 2.5 架构约束（评审必查）

1. 任何状态变更必须经 StateMachine 裁决；Controller 不得直接改 `claim.status`。
2. 前端按钮显隐只读后端 `allowed_events`，不得在前端重写迁移规则（避免两端规则漂移）。
3. 接口前缀统一 `/api/v1`；前端 `baseURL` 亦为 `/api/v1`（v2.0 修正：原 `/api` 会导致全部 404）。
4. 契约未提供的接口不许在页面里硬编码路径——宁可在页面上标注能力缺口（见 §7.6）。

---

## 3 模块划分

| 构件 | 职责 | 主要接口 | 实现落点 | 归属 |
|---|---|---|---|---|
| auth-module | 登录、当前用户、token 校验 | #2 #3 | `main.py:191-208`；`web/src/api/auth.ts` | 邓昌兴 |
| items-module | 拾获登记、失物启事、物品详情 | #7–#11 | `main.py:224-273` | 金道轩 |
| dict-module | 分类 / 地点字典读取 | #5 #6 | `main.py:211-221` | 欧阳昊天 |
| claims-module | 认领申请提交、我的申请、详情、补充 | #12–#15 | `service.py:65-93,209-221` | 李子研 |
| **review-module** | 队列、接单、**身份核验**、通过、驳回、退补、交接、取消、超时失效 | #16–#24 | `service.py:97-246` | 李子研 |
| **state-machine**（纯构件） | 迁移表裁决 + `allowed_events` | 被 review/claims 调用 | `state_machine.py` | 李子研 |
| notify-module | 站内通知（迁移伴随动作，无独立写入口） | #4 | `service.py:18-21`；`main.py:394` | 共用 |
| admin-module | 用户管理、字典维护、统计、日志、导出 | #25–#30 | `main.py:404-556` | 欧阳昊天 |
| web-shell | 登录页、布局、路由守卫、请求封装 | — | `web/src/{router,stores,utils,layouts}` | 邓昌兴 |

---

## 4 数据库设计

### 4.1 表清单与关系

9 张表：`user`、`category`、`location`、`lost_item`、`found_item`、`claim`、`review_record`、`notification`、`audit_log`。

```
user 1──n lost_item        （发布人）
user 1──n found_item       （拾获人 finder_id，可空）
user 1──n claim            （applicant_id 与 reviewer_id 两个外键指向同一张表）
found_item 1──n claim      （一件物品可有多张认领单，但同一人同一物品不得重复在途）
claim 1──n review_record   （cascade=delete-orphan，order_by=id，见 models.py:103）
user 1──n notification     （站内通知收件人）
user 1──n audit_log        （actor_id 弱关联，不建外键以保日志独立留存）
category 1──n lost_item / found_item（分类只能取字典值）
```

### 4.2 字段定义（关键表）

**claim（核心表，`models.py:90-104`）**

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | int | PK | 认领单号 |
| found_item_id | int | FK→found_item，索引 | 认领对象 |
| applicant_id | int | FK→user，非空，索引 | 申请人 |
| reviewer_id | int | FK→user，索引，可空 | 接单人；接单时锁定，用于 I6 越权判定 |
| description | varchar(500) | 默认 '' | 丢失经过补充说明 |
| proof | varchar(500) | **非空** | 自证特征；防冒领第一道校验 |
| contact | varchar(50) | 默认 '' | 联系方式 |
| status | varchar(20) | 非空，索引，默认 SUBMITTED | 8 态之一 |
| deadline | datetime | 可空 | 仅 PENDING_INFO / APPROVED 使用 |
| submitted_at / updated_at | datetime | 默认 now | 队列排序、统计耗时 |

**review_record（状态机流水，`models.py:107-117`）**：`claim_id`(FK,索引)、`reviewer_id`、`action`、`from_status`(可空，SUBMIT 时为 NULL 表示起点)、`to_status`、`comment`、`created_at`。**每次迁移必写一条**（I2）；`VERIFY` 自环的 `from_status == to_status == APPROVED`。

**user（`models.py:35-44`）**：`student_no`(唯一+索引)、`name`、`role`(student/reviewer/super_admin)、`phone`、`status`(ACTIVE/DISABLED)、`password_hash`(sha256)、`created_at`。停用账号登录即被拒（`main.py:191-203`）。

**found_item（`models.py:74-87`）**：`finder_id`、`title`、`description`、`category_id`、`found_location`、`found_time`、`image_url`、`storage_location`、`status`(REGISTERED→CLAIMING→PICKUP_PENDING→CLAIMED，旁路 CLOSED)。**无「待审核」态**：登记即生效，因此不存在「发布审核」动作（见 §7.6-③）。

**lost_item（`models.py:61-71`）**：`user_id`、`title`、`description`、`category_id`、`lost_location`、`lost_time`、`status`(OPEN/MATCHED/CLOSED)。

**category / location（`models.py:47-58`）**：`name`(唯一) + `sort_order`；字典只增不删不改。

**notification（`models.py:120-127`）**：`user_id`(索引)、`title`、`content`、`is_read`、`created_at`。

**audit_log（`models.py:130-138`）**：`actor_id`、`entity`、`entity_id`、`action`、`detail`、`created_at`；`entity` 取值固定为 `claim`/`user`/`category`/`location`/`system`，C 端日志页据此做服务端筛选。

### 4.3 索引与外键策略

- 所有外键列建索引：`claim.found_item_id`、`claim.applicant_id`、`claim.reviewer_id`、`found_item.finder_id`、`lost_item.user_id`、`review_record.claim_id`、`notification.user_id`。
- `claim.status` 建索引：审核队列 `WHERE status IN ('SUBMITTED','PENDING_INFO')` 与统计 `GROUP BY status` 都走它。
- `user.student_no` 唯一索引：登录查询与学号唯一性一箭双雕。
- SQLite 默认不校验外键，原型启动时显式 `PRAGMA foreign_keys=ON`（`models.py:19-24`）；迁移 MySQL 后由 InnoDB 原生保证。

### 4.4 设计决策

1. **claim 与 review_record 分离**：`claim.status` 只存当前态，流水表记录每次迁移（含 VERIFY），两者互证，可完整回放审核历史。
2. **found_item.status 与认领单联动**：APPROVE→PICKUP_PENDING（防他人重复认领），HANDOVER→CLAIMED，驳回/撤销/失效回退 REGISTERED。
3. **deadline 支撑超时**：PENDING_INFO / APPROVED 携带截止时间，由批处理统一扫表置 EXPIRED，不给每单起定时器。
4. **字典表独立**：分类与地点从枚举升级为表（v1），C 端维护、A/B 端下拉复用；单据仍冗余存地点**文本**，保证检索与历史留存不受字典变更影响。
5. **audit_log 转正**：关键动作双写「状态流水 + 审计日志」，前者面向业务追溯，后者面向运维与 C 端日志查询。
6. **密码存 sha256 而非明文**：课程场景可接受；生产应换 BCrypt（Spring Boot 侧 `SecurityConfig` 已预留 `PasswordEncoder` 位）。

### 4.5 与 MySQL 建表脚本的差距（已知缺口）

`src/lost-found-server/sql/01-create-database.sql` 目前只创建 `lost_found` 库（`utf8mb4`），表结构留待 `02-schema.sql`；字段口径以 §4.2 与契约 §2 为准，由李子研出 DDL、邓昌兴执行联调。这是**后端骨架侧的未完成项**，不影响原型与前端联调。

---

## 5 核心设计：认领单审核状态机

### 5.1 状态与事件全集

8 状态（`state_machine.py:12-21`）：`SUBMITTED` 待审核、`UNDER_REVIEW` 审核中、`PENDING_INFO` 待补充材料、`APPROVED` 审核通过·待领取、`REJECTED` 已驳回、`CANCELLED` 已撤销、`COMPLETED` 已完成、`EXPIRED` 已失效。其中 **4 个终态**：REJECTED / CANCELLED / COMPLETED / EXPIRED。

9 事件（`state_machine.py:25-35`）：`ACCEPT`、`VERIFY`(自环)、`APPROVE`、`REJECT`、`REQUEST_INFO`、`RESUBMIT`、`HANDOVER`、`CANCEL`、`EXPIRE`(系统)。

### 5.2 迁移表（12 条 + 1 自环）

| # | from | event | to | 允许角色 | comment 必填 |
|---|---|---|---|---|---|
| 1 | SUBMITTED | ACCEPT | UNDER_REVIEW | reviewer | 否 |
| 2 | SUBMITTED | REJECT | REJECTED | reviewer | **是** |
| 3 | SUBMITTED | CANCEL | CANCELLED | student(本人) | 否 |
| 4 | UNDER_REVIEW | APPROVE | APPROVED | reviewer(接单人) | 否 |
| 5 | UNDER_REVIEW | REJECT | REJECTED | reviewer | **是** |
| 6 | UNDER_REVIEW | REQUEST_INFO | PENDING_INFO | reviewer(接单人) | **是** |
| 7 | UNDER_REVIEW | CANCEL | CANCELLED | student(本人) | 否 |
| 8 | PENDING_INFO | RESUBMIT | UNDER_REVIEW | student(本人) | 否 |
| 9 | PENDING_INFO | CANCEL | CANCELLED | student(本人) | 否 |
| 10 | PENDING_INFO | EXPIRE | EXPIRED | system | 否 |
| 11 | APPROVED | HANDOVER | COMPLETED | reviewer(接单人) | 否 |
| 12 | APPROVED | EXPIRE | EXPIRED | system | 否 |
| — | APPROVED | VERIFY | APPROVED（自环） | reviewer(接单人) | 否 |

`VERIFY` 不进迁移表，由 Service 直接写流水（`service.py:107-128`），因为它不改变「当前状态下可执行的事件集合」。

### 5.3 裁决算法

`check()` 五步短路（`state_machine.py:102-118`），任一步失败即抛领域异常：

```
1. 事件合法？   event ∉ EVENTS               → 40003
2. 终态封闭？   is_terminal(state)           → 40001
3. 边存在？     (state,event) ∉ TRANSITIONS  → 40001（detail 附「可执行事件：…」）
4. 角色匹配？   actor_role ∉ actors          → 40002（detail 附允许角色集）
5. 意见必填？   need_comment 且 comment 为空  → 40003
↓ 返回 to_state，由 _persist 落库
```

第 3 步的 detail 会把 `allowed_events(state)` 一并回传，前端可直接展示「当前只能做这几件事」，人工测试时也不必翻文档（对应非功能项 N2）。

### 5.4 不变量与落点

| # | 不变量 | 落点 |
|---|---|---|
| I1 | 终态无出边，任何事件返回 40001 | `state_machine.py:106-107`；四条终态不在 TRANSITIONS 的 from 列 |
| I2 | 每次迁移写一条 review_record | `service.py:32-36`（唯一落库入口） |
| I3 | APPROVE 后 found_item→PICKUP_PENDING，他人不可再申请 | `service.py:138-140`；`service.py:70-71` 提交前状态校验 |
| I4 | HANDOVER 后 found_item→CLAIMED | `service.py:181-183` |
| I5 | REJECT / REQUEST_INFO 的 comment 必填 | `state_machine.py:116-117` |
| I6 | APPROVE / HANDOVER / VERIFY 仅限已接单 reviewer 本人 | `service.py:43-46` `_require_owner` |
| **I7** | **HANDOVER 前必须存在该单 VERIFY 通过流水** | `service.py:49-57` `_require_verified`（按 `comment LIKE '核验通过%'` 判定） |

I7 是 v1 的关键增量：把「防冒领」从口头要求变成代码约束——未核验直接交接返回 **40003**，已被冒烟测试覆盖（`smoke_test.py` 第 14 项）。

### 5.5 伴随动作矩阵

迁移不是单纯改状态，每个事件绑定的副作用如下（同一事务提交）：

| 事件 | claim 变化 | found_item 变化 | 通知 | 流水/审计 |
|---|---|---|---|---|
| SUBMIT | 新建 SUBMITTED | →CLAIMING | — | 写 SUBMIT（from=NULL） |
| ACCEPT | 锁 reviewer_id | — | 通知申请人已受理 | 写 ACCEPT |
| VERIFY | 不变（自环） | — | 核验失败时通知申请人 | 写 VERIFY（成败都写，comment 记原因） |
| APPROVE | deadline=+7d | →PICKUP_PENDING | 通知领取期限与地点 | 写 APPROVE |
| REJECT | — | CLAIMING→REGISTERED | 通知驳回原因 | 写 REJECT |
| REQUEST_INFO | deadline=+7d | — | 通知补充内容与期限 | 写 REQUEST_INFO |
| RESUBMIT | 覆盖 proof，清 deadline | — | 通知接单审核员 | 写 RESUBMIT |
| HANDOVER | 清 deadline | →CLAIMED | 通知申请人已归还；**并通知拾获人** | 写 HANDOVER |
| CANCEL | — | CLAIMING/PICKUP_PENDING→REGISTERED | 通知接单审核员 | 写 CANCEL |
| EXPIRE | — | 仅 APPROVED 超期时 PICKUP_PENDING→REGISTERED | 通知申请人已失效 | 写 EXPIRE（actor=NULL，detail 记截止时间） |

**通知对象的设计意图**：HANDOVER 同时通知拾获人，让「拾金不昧」形成正反馈；CANCEL 通知审核员，避免其继续处理已作废单据。

### 5.6 终态封闭与超时收敛

- 终态不出现于迁移表 from 列 → 天然不可再迁移，无需额外分支判断。
- 超时由 `expire_due()` 扫表收敛（`service.py:225-246`）：条件为 `status IN (PENDING_INFO, APPROVED) AND deadline IS NOT NULL AND deadline < now`；单次批处理返回 `{expired, ids}`，可重复执行。

---

## 6 详细设计

### 6.1 A 端（学生）

| 接口 | 前置条件 | 后置条件 | 落点 |
|---|---|---|---|
| #5/#6 字典 | 已登录 | 返回数组（非分页结构），下拉直接消费 | `main.py:211-221` |
| #7 GET /found-items | 已登录；`keyword` 只按标题模糊匹配 | `{total, items}`，按 id 倒序分页 | `main.py:224-233` |
| #8 GET /found-items/{id} | 已登录 | 单品详情 + 当前状态 | `main.py:247-253` |
| #9 POST /found-items | title/category_id 必填 | 直接落库为 REGISTERED（**无待审态**） | `main.py:235-245` |
| #10/#11 失物启事 | 已登录；创建仅返回 `{id,status}` | 状态 OPEN | `main.py:255-273` |
| #12 POST /claims | 见 §6.2 五道校验 | 新建 SUBMITTED，物品→CLAIMING | `service.py:65-93` |
| #13 GET /claims?scope=mine | 已登录 | 仅本人单据，无分页参数 | `main.py:284-294` |
| #14 GET /claims/{id} | 本人或 reviewer/super_admin | 含 `records` 完整流水 | `main.py:296-303` |
| #15 POST /claims/{id}/supplement | 本人 + 状态 PENDING_INFO | proof 覆盖，→UNDER_REVIEW，清 deadline | `service.py:209-221` |
| #16 POST /review/claims/{id}/cancel | 本人 + 非终态 | →CANCELLED，物品回退 | `service.py:193-206` |

### 6.2 认领申请的五道校验

提交是唯一会「凭空产生单据」的入口，因此校验最密（`service.py:65-93`）：

1. 物品存在？（不存在 → 40401）
2. 物品状态 ∈ {REGISTERED, CLAIMING}？（否则 40003「该物品当前状态 X，不可申请认领」）
3. `proof` 去空后非空？（否则 40003）
4. **同人同物品无在途单**？查 `status IN (SUBMITTED, UNDER_REVIEW, PENDING_INFO, APPROVED)`，命中则 40003 并回传已有单号
5. 写入后联动 `found_item.status = CLAIMING`

第 4 条只拦「在途」，已终态（驳回/撤销/失效）允许重新申请——这是业务上必要的宽松，否则一次误驳回即永久封死。

### 6.3 B 端审核模块（契约 #17–#24）

| 接口 | 前置条件 | 后置条件 |
|---|---|---|
| #17 GET /review/queue | reviewer 角色 | 仅 SUBMITTED + PENDING_INFO，按 `submitted_at` 升序；投影 `waiting_minutes`/`applicant`/`title` |
| #18 POST .../accept | 状态 = SUBMITTED | →UNDER_REVIEW，锁定 `reviewer_id` |
| #19 POST .../verify | 状态 = APPROVED 且本人接单 | 写 VERIFY 流水（不改状态），返回 `{verified, comment}` |
| #20 POST .../approve | 状态 = UNDER_REVIEW 且本人接单 | →APPROVED，物品→PICKUP_PENDING，deadline=+7d |
| #21 POST .../reject | 状态 ∈ {SUBMITTED, UNDER_REVIEW}，comment 必填 | →REJECTED，物品回退 |
| #22 POST .../request-info | 状态 = UNDER_REVIEW，comment 必填 | →PENDING_INFO，deadline=+7d |
| #23 POST .../handover | 状态 = APPROVED、本人接单、**I7 已核验** | →COMPLETED，物品→CLAIMED |
| #24 POST /review/expire-run | reviewer 角色 | 超期单→EXPIRED，返回失效 id 列表 |

**队列口径**：按 `submitted_at` 升序（先到先审）；`waiting_minutes` 由服务端现算，前端按等待时长二次排序只影响本页展示；`PENDING_INFO` 进队列是因为补材料后需要审核员继续跟，而不是重新排队。

### 6.4 C 端后台（契约 #25–#30）

| 接口 | 权限 | 要点 | 落点 |
|---|---|---|---|
| #25 GET /admin/users | super_admin | `keyword` 同时匹配学号与姓名，`page/size` 分页 | `main.py:406-420` |
| #26 PUT /admin/users/{id}/status | super_admin | 启停账号；**禁止改自身状态**、**禁止停用其他超管**（两者均 40003） | `main.py:422-438` |
| #27/#28 字典读写 | super_admin | 列表 + 新增共四条路由；名重复 40003 | `main.py:441-478` |
| #29 GET /admin/stats/overview | super_admin | 五块指标：users / items / claims / rates / audit_total | `main.py:483-525` |
| #30 GET /admin/audit-logs | super_admin | **`entity` 服务端筛选** + 分页，按 id 倒序 | `main.py:529-545` |
| #30 GET /admin/export/claims.csv | super_admin | 全量 CSV，`utf-8-sig` 带 BOM 便于 Excel 直开 | `main.py:548-559` |

统计口径固定为：`completion_rate = COMPLETED/total`、`timeout_rate = EXPIRED/total`、`pending = SUBMITTED + PENDING_INFO`、`avg_review_minutes = 各 APPROVE 流水时间 − 该单 submitted_at` 的均值。指标定义写在代码里而非文档里，保证看板与答辩口径一致。

### 6.5 前端页面与接口映射

23 个业务页面（另含登录页与 404）与接口的对应关系，是「设计→实现」最直接的核对表：

| 端 | 页面 | 主要接口 |
|---|---|---|
| A | 大厅 | #7 列表 + #5/#6 下拉（分类/地点为**当前页本地筛选**，页面已明示） |
| A | 物品详情 | #8 + #5 |
| A | 发布信息 | #9 / #11 + #5/#6（双页签双表单） |
| A | 我的发布 | #7 + #10（按当前用户 id 本地归属过滤，页面已标注） |
| A | 提交认领 | #8 + #12 |
| A | 我的申请 | #13 + #14 + #15 + #16（详情抽屉含流水时间线） |
| A | 消息通知 | #4（只读，无已读回写） |
| A | 个人中心 | #3 + #13 + #4 |
| B | 审核工作台 | #17 + #18 + #24 |
| B | 发布核查 | #7 + #10（字段完整性核查，不改状态） |
| B | 认领审核 | #17 + #14 + #18–#23（主从布局，按钮全由 `allowed_events` 驱动） |
| B | 归还登记 | #14 + #19 + #23（未核验禁用交接） |
| B | 审核记录 | #14（流水追溯 + 动作计数 + 处理时长） |
| B | 个人中心 | #3 + #17 |
| C | 数据看板 | #29 + #30 导出 |
| C | 用户管理 | #25 + #26 |
| C | 分类管理 | #27 + #28（查询 + 新增） |
| C | 物品管理 | #7 + #10 |
| C | 认领管理 | #29（状态分布）+ #14（按单号查）+ #30 导出 |
| C | 公告管理 | #4（群发公告契约未提供，页面标注缺口） |
| C | 操作日志 | #30（entity 服务端筛选 + 本页导出） |
| C | 系统设置 | #24 + #30（运维动作 + 规则口径只读展示） |
| C | 个人中心 | #3 + #29 |

---

## 7 安全与异常设计

### 7.1 认证

登录 `POST /auth/login` 校验 `student_no + password`，签发随机 token 并登记到服务端映射（原型 `TOKENS: dict[str, int]`，`main.py:60`）；后续请求经 `Authorization: Bearer <token>` 解析出 `User`，解析失败统一 40101 且 HTTP 401。**登录字段是学号 `student_no`，不是 `username`**——这是联调期最高频的踩坑点。

Spring Boot 侧对应实现为 `JwtUtil` + `JwtAuthenticationFilter` + `SecurityConfig`（无状态、放行 `/auth/login`，其余走过滤器）。

### 7.2 RBAC 矩阵

| 能力 | student | reviewer | super_admin |
|---|---|---|---|
| 大厅 / 详情 / 发布 / 提交认领 | ✓ | ✓ | ✓ |
| 我的申请、补充、撤销 | 仅本人 | 仅本人 | 仅本人 |
| 审核队列与状态流动作 | ✗（40002） | ✓ | ✗（40002） |
| 交接 | ✗ | ✓（需 I7） | ✗ |
| 超时批处理 | ✗ | ✓ | ✗ |
| 用户 / 字典 / 统计 / 日志 / 导出 | ✗ | ✗ | ✓ |

角色判定由依赖注入完成：`current_user` → `reviewer_only` / `super_admin_only`（`main.py:62-83`），**逐接口显式声明**，不存在「默认放行」。注意 `super_admin` 不是通用超集——它不能调用 B 端审核接口，这是刻意的职责分离。

### 7.3 越权三类

| 类型 | 场景 | 判定点 | 错误码 |
|---|---|---|---|
| 水平越权 | 学生 A 查看/撤销学生 B 的单 | `claim.applicant_id != user.id` | 40002（`service.py:194-195`） |
| 抢单越权 | 审核员 B 处理 A 已接的单 | `claim.reviewer_id != actor.id` | 40002（`service.py:43-46`） |
| 垂直越权 | 学生调 `/review/*` 或 `/admin/*` | 角色依赖注入 | 40002（`main.py:73-83`） |

### 7.4 统一响应与错误码

```json
{ "code": 0, "message": "ok", "data": { } }
{ "code": 40001, "message": "ILLEGAL_TRANSITION", "detail": "SUBMITTED(待审核) 不允许事件 APPROVE；可执行事件：['ACCEPT','REJECT','CANCEL']" }
```

| 码 | 含义 | HTTP | 触发方 |
|---|---|---|---|
| 0 | 成功 | 200 | — |
| 40001 | 非法状态迁移 | 400 | StateMachine |
| 40002 | 无权限（角色 / 归属） | 400 | 依赖注入 / `_require_owner` |
| 40003 | 参数或前置校验失败 | 400 | Pydantic / `_require_verified` / 业务校验 |
| 40401 | 资源不存在 | 404 | `_get_claim` |
| 40101 | 未登录 / token 失效 | 401 | `current_user` |

领域异常到 HTTP 的映射集中在一处（`main.py:45-56`），业务代码只抛语义异常，不关心状态码。

### 7.5 并发与一致性

- 每请求一个 `Session`，`get_db()` 用 `yield/finally` 保证关闭；迁移、伴随动作、通知、审计在**同一事务**提交，避免「状态变了但没发通知」。
- 原型单进程 SQLite：接单属「检查后写入」，理论上存在两人同时接单的极小窗口。生产（MySQL）应改为条件更新 `UPDATE claim SET status='UNDER_REVIEW', reviewer_id=? WHERE id=? AND status='SUBMITTED'`，以受影响行数判定成败。见 §7.6-⑤。
- 批处理 `expire_due` 可重复执行且幂等收敛（只处理已超期且在途的单）。

### 7.6 已知偏差清单（文档 ↔ 代码，逐条登记）

| # | 偏差 | 影响 | 处置 |
|---|---|---|---|
| ① | **#1 POST /auth/register 未实现** | 新增学生须由管理员建账号或使用种子数据 | 演示不受影响；如需开放注册，补一个路由即可 |
| ② | **#10 GET /lost-items 忽略 `keyword/page`**，全量返回 | 启事量大时前端拿全量（前端按 100 条拉取并本地过滤） | 契约要求分页，属待补项 |
| ③ | **无「发布审核」动作**：物品登记即 REGISTERED | 后台「发布审核」页改为字段完整性核查，不改状态，页面已注明 | 如需审核流须新增 `PENDING` 态与接口，涉及状态机变更，需全组重冻结契约 |
| ④ | **#30 导出为 CSV，契约写 xlsx**；#29 未实现 `date_range` | 前端按 CSV 下载（`api/admin.ts` 已对齐）；看板时间筛选暂透传空参 | 以能跑通的原型为准，契约文字待修订 |
| ⑤ | 接单非条件更新（见 §7.5） | 单机演示无影响 | 迁移 MySQL 时改条件更新 |
| ⑥ | **Spring Boot 侧 `ResultCode.SUCCESS = 200`**，与契约「成功码 0」不一致 | 骨架若照此实装，前端会判失败 | **必须改**为 `SUCCESS(0, "操作成功")`；当前最应优先修的一处不一致 |
| ⑦ | 认证 token 存内存 `TOKENS`，重启即失效 | 演示时重启后端需重新登录 | 生产用 JWT（骨架已引入 jjwt） |
| ⑧ | 无文件上传接口（`api/file.ts` 直接抛错提示） | 拾获登记只能填图片外链 | 契约未定义上传，前端不编路径 |

---

## 8 设计取舍记录

| 决策 | 备选 | 取舍理由 |
|---|---|---|
| 事件驱动状态机（迁移表） | if-else 散落在路由 | 迁移集中可测、可与契约逐行核对；迁移到 Spring Boot 时成为独立构件 |
| VERIFY 自环而非新增 VERIFIED 状态 | 加状态 | 核验不改变可执行事件集合，加状态徒增两条边；自环 + 流水同样可审计 |
| review_record + audit_log 双写 | 只更新 status | 业务追溯与运维审计诉求不同，双写成本低、收益明确 |
| deadline + 批处理扫表 | 每单起定时器 | 实现简单、可幂等重跑，课程场景足够 |
| 字典表 + 单据冗余地点文本 | 单据只存字典外键 | 检索与历史留存不被字典变更破坏，代价是可容忍的冗余 |
| 前端按钮全由 `allowed_events` 驱动 | 前端硬编码状态判断 | 状态机是唯一事实源，避免两端规则漂移导致「点了报错」 |
| `useTable` 组合函数统一分页 | 每页各写一遍 | 分页口径（page 从 1、`{total,items}`）只维护一处 |
| 契约缺口在页面显式标注、不编接口 | 造假接口先跑通 | 答辩时「点了没反应」比「说明暂不支持」更致命；标注缺口本身可讲取舍 |
| 双轨交付（方案 C） | 全组改 Python / 重写 Spring Boot | 文档口径不返工；原型保底演示；24 项冒烟即测试素材 |
| 三端单工程按路由分流 | 三个独立仓库 | 一套请求封装、一套状态映射、一套组件，减少重复与漂移 |

---

## 9 关键流程时序设计

### 9.1 主链（提交→接单→核验→交接）

```
学生              Controller        StateMachine         Service              DB
 │ POST /claims      │                  │                    │                  │
 ├──────────────────>│ 校验物品状态/重复申请                   │                  │
 │                   ├─────────────────────────────────────>│ 建单 SUBMITTED   │
 │                   │                  │                    ├─ 写 record+audit │
 │                   │                  │                    ├─ item→CLAIMING   │
 │ 审核员 GET /review/queue              │                    │                  │
 ├──────────────────>│ 过滤 SUBMITTED/PENDING_INFO，现算 waiting_minutes       │
 │ POST .../accept    │                  │                    │                  │
 ├──────────────────>│─────────────────>│ check(SUBMITTED,ACCEPT,reviewer)      │
 │                   │                  │<── UNDER_REVIEW ───┤                  │
 │                   │                  │                    ├─ 锁 reviewer_id   │
 │                   │                  │                    ├─ 通知申请人       │
 │ POST .../verify    │                  │                    │                  │
 ├──────────────────>│ 比对学号/姓名      │                    ├─ 写 VERIFY 流水  │
 │                   │                  │                    │  （不改状态）     │
 │ POST .../approve   │                  │                    │                  │
 ├──────────────────>│─────────────────>│ check(UNDER_REVIEW,APPROVE)           │
 │                   │                  │                    ├─ deadline=+7d    │
 │                   │                  │                    ├─ item→PICKUP_PENDING
 │ POST .../handover  │                  │                    │                  │
 ├──────────────────>│ 先查 I7 核验流水   │                    │                  │
 │                   │─────────────────>│ check(APPROVED,HANDOVER)              │
 │                   │                  │                    ├─ item→CLAIMED    │
 │                   │                  │                    ├─ 通知申请人+拾获人│
```

### 9.2 退回补充回环

`UNDER_REVIEW --REQUEST_INFO(comment 必填)--> PENDING_INFO`（deadline=+7d）→ 申请人 `POST /claims/{id}/supplement`（本人 + 状态校验 + proof 非空）→ `PENDING_INFO --RESUBMIT--> UNDER_REVIEW`（清 deadline）→ 审核员继续处理。若 7 天未补充，批处理置 `EXPIRED`；**PENDING_INFO 期间物品保持 CLAIMING**，防止他人抢走正在补材料的单。

### 9.3 超时批处理

`POST /review/expire-run`（reviewer 权限，可传 `now` 供测试）→ 查 `status IN (PENDING_INFO, APPROVED) AND deadline < now` → 逐条 `apply(EXPIRE, system)` → 写流水（actor=NULL，detail 记截止时间）+ 审计 + 通知 → APPROVED 超期的物品回退 REGISTERED → 返回 `{expired, ids}`。演示时传 `{"now":"2026-12-31 00:00:00"}` 可一次性制造超时，不必等 7 天。

---

## 10 接口设计规范

1. **前缀与版本**：全部 `/api/v1`（Spring Boot 侧 context-path 为 `/api`，Controller 映射 `/v1/...`）。
2. **响应信封**：`{code, message, data}`；列表恒为 `{total, items}`；失败额外带 `detail`（可直接展示的中文原因）。
3. **分页**：`page` 从 **1** 开始，`size` 默认 10（用户 20、日志 30）；`total` 为过滤后总数。
4. **鉴权**：`Authorization: Bearer <token>`；无 token / 失效 → HTTP 401 + code 40101。
5. **时间**：统一 `yyyy-MM-dd HH:mm:ss`（Jackson 全局配置与 Pydantic 序列化对齐）。
6. **动作型接口**：一律 `POST /资源/{id}/{动作}`，动作名即事件名（accept / verify / approve / reject / request-info / handover / cancel），与状态机事件一一对应，可按 URL 反查迁移。

---

## 11 可测试性设计

| 手段 | 覆盖 | 规模 | 位置 |
|---|---|---|---|
| 状态机冒烟 | 12 条迁移主路径、VERIFY 自环、I7 前置、终态封闭、角色权限、超时失效 | **24 项** | `smoke_test.py` |
| C 端实机验证 | 六个 C 端接口可用、学生越权 40002、自停 40003、停/启用他人 | **11 项** | `verify_c_end.py` |
| 前端 SFC 校验 | 全部 33 个 .vue 的解析与编译期错误 | 33 个文件 | 构建期 `vue-tsc` |
| 端到端演示 | 三账号登录→接单→通过→未核验被拒→核验→交接→COMPLETED，流水五条齐全 | 主链 1 条 | `doc/20-演示脚本.md` |

CSV 导出为手工验证项（下载文件能被 Excel 正确解析，`utf-8-sig` BOM 生效），未纳入自动断言。

设计上刻意让状态机不依赖数据库，因此 24 项冒烟可用 `TestClient` 直跑真实 HTTP，无需 mock。

---

## 12 需求-设计追溯

| 需求 | 本文落点 |
|---|---|
| R1 / R2 登记与启事 | §4.2 found_item / lost_item；§6.1 #9 #11 |
| R3 / R4 提交与去重 | §6.2 五道校验 |
| R5 / R6 队列与接单 | §6.3 #17 #18 |
| R7 / R8 通过与驳回 | §5.5 伴随动作；§6.3 #20 #21 |
| R9 退回补充 | §5.2 #6 #8；§9.2 |
| R10 交接闭环 | §5.4 I4 / I7；§6.3 #23 |
| R11 撤销 | §5.2 #3 #7 #9 |
| R12 超时失效 | §5.6；§9.3 |
| R13 全程可追溯 | §4.1 claim↔review_record；§5.4 I2 |
| R14 三角色权限 | §7.2 RBAC 矩阵 |
| R15 统一错误语义 | §7.4 错误码表 |
| R16 交接前核验 | §5.4 I7；§6.3 #19 |
| R17–R20 C 端四项 | §6.4 #25–#30 |
| N1–N5 非功能 | §2.5 架构约束、§7.5 并发、§11 可测试性 |

逐条带实现行号的完整对照见 `doc/13-需求-设计对照表.md`。

---

## 附录 A　可运行参考实现说明（修正 v1.1 的路径误称）

- **位置**：`src/lost-found-prototype/`，6 个文件 1 340 行——`main.py`(673) 控制层与路由、`service.py`(246) 领域服务、`state_machine.py`(123) 纯状态机、`models.py`(142) ORM、`smoke_test.py`(104)、`verify_c_end.py`(52)。
- **运行**：`uvicorn main:app --reload`；接口文档 `/docs`；演示前端 `GET /`（`web/` 静态托管，挂 `/static`，零 CORS）。
- **数据**：SQLite 单文件 `lostfound.db`，首次启动自动建表 + 种子数据（4 账号 `reviewer001`/`stu001`/`stu002`/`super001`，密码均 `123456`；6 分类 + 6 地点 + 3 物品 + 3 认领单，覆盖 SUBMITTED / UNDER_REVIEW / APPROVED 三态，其中一单 deadline 已过期，供演示 `expire-run`）。
- **实现范围**：契约 30 条编号（33 个路由点）中实现 **32 个路由**，仅缺 #1 注册；#27 / #28 / #30 各含两条路由。
- **向 Spring Boot 迁移映射**：`models.py` → entity + Mapper（字段名不变，下划线转驼峰由 `map-underscore-to-camel-case` 处理）；`state_machine.py` → `state-machine` 构件（迁移表原样翻译）；`service.py` → `ReviewService`（`_persist` 即事务方法）；`main.py` 路由 → Controller。

## 附录 B　修订记录

| 版本 | 日期 | 修订人 | 内容 |
|---|---|---|---|
| v1.0 | 2026-11-03 | 李子研 | 总体设计、数据库、状态机、B 端审核模块 |
| v1.1 | 2026-11-05 | 李子研 | 技术口径统一 Vue3 + Spring Boot + MySQL；FastAPI 降为原型，单列附录 |
| v2.0 | 2026-11-06 | 金道轩 | 扩为全系统三端设计；结论全部回填 `文件:行号`；补字段级表、伴随动作矩阵、时序、接口规范、可测试性、追溯；新增 §7.6 已知偏差（8 条）；修正 v1.1 三处事实错误（原型目录误称、C 端「未含」、#1–#24 范围） |
