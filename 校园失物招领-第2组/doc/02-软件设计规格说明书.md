# 设计说明书 — 校园失物招领与认领审核系统（审核端模块 · 李子研）v1.1

> 依据：`api-contract-v1.md`（已重新冻结）。本文档描述总体设计、数据库设计、核心状态机设计与 B 端审核模块详细设计。
> **v1.1 变更**：技术口径统一为全组约定 **Vue3 + Spring Boot + MySQL**（对齐《术语表-v0》《材料模板》《任务卡》）；随文的 FastAPI 实现降级为「审核状态流原型 + 演示保底」，单列附录 A，不再作为正式技术方案。

## 1. 系统概述

系统解决校园失物招领中"认领无凭证、审核无流程、交接无记录"的问题。核心是一条**认领单审核状态流**：申请人提交凭证 → 审核员接单审核（可退回补充）→ 通过后现场身份核验 → 交接确认闭环，全程留痕可追溯。系统分三端：

| 端 | 用户 | 核心功能 |
|---|---|---|
| A 端 | 学生（student） | 失物启事、拾获登记、认领申请、补充材料 |
| B 端 | 审核员（reviewer） | 审核队列、接单、身份核验、通过/驳回/退补、交接（**本模块**） |
| C 端 | 超级管理员（super_admin） | 用户管理、分类/地点字典、公告、统计看板、日志查询、Excel 导出 |

## 2. 总体架构（正式方案：Vue3 + Spring Boot + MySQL）

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ A端 Vue3 │  │ B端 Vue3 │  │ C端 Vue3 │      ← 三角色三入口
└────┬─────┘  └────┬─────┘  └────┬─────┘
     └────── Nginx 反向代理 ──────┘
┌────────────────────────────────┐
│   Spring Boot 单体（按包分构件） │
│ Controller：Auth/Item/Claim/    │
│             Review/Admin        │
│ Service：…+ NotifyService       │
│ ★ StateMachine 构件（唯一裁决点）│
│ MyBatis-Plus Mapper（9 张表）    │
├────────────────────────────────┤
│ MySQL 8.0 ｜ 本地文件存储 ｜      │
│ @Scheduled 超时批处理            │
└────────────────────────────────┘
```

分层与约束：Controller 只做参数校验与鉴权 → Service 承载事务 → **状态迁移必须经 StateMachine 构件裁决**，任何代码不得直接 UPDATE claim.status → Mapper 落库。体系结构图、构件图、部署图见 `设计模型/07~09`。

> **附录 A（原型）**：`server/`（FastAPI + SQLAlchemy + SQLite）是上述架构的同构最小实现，用于审核状态流的早期验证、16 项（现 24 项）冒烟测试与 D2 彩排/答辩现场演示保底；构件划分与 Spring Boot 版一一对应（state_machine.py↔state-machine 构件、service.py↔review-module、main.py↔Controller 层），迁移路径见《接口-代码检查表》§五。

## 3. 模块划分（对应构件图 08）

| 构件 | 职责 | 归属 |
|---|---|---|
| auth-module | 注册/登录/token/账号状态 | A 端同学 |
| items-module | 拾获登记/失物启事/字典读取 | A 端同学 |
| claims-module | 认领申请提交/查询/补充/撤销 | 共用 |
| **review-module** | 审核队列、接单、**身份核验**、通过、驳回、退补、交接、超时失效 | **本模块（B 端）** |
| state-machine（纯构件） | 迁移表裁决 + allowed_events（前端按钮置灰数据源） | **本模块** |
| notify-module | 站内通知 | 共用 |
| admin-module | 用户管理/字典维护/统计/日志/导出 | 欧阳昊天 |

## 4. 数据库设计（9 张表，契约 §2）

user / category / location / lost_item / found_item / claim / review_record / notification / audit_log。关键设计决策：

1. **claim 与 review_record 分离**：claim.status 只存当前态，review_record 以流水记录每次迁移（含 VERIFY 核验记录），两者互证，支持回放完整审核历史。
2. **found_item.status 与 claim 状态联动**：APPROVE→PICKUP_PENDING（防重复认领），HANDOVER→CLAIMED，驳回/失效回退 REGISTERED。
3. **deadline 支撑超时**：PENDING_INFO / APPROVED 可携带截止时间，由定时任务构件统一扫表置 EXPIRED。
4. **category/location 字典表**（v1 新增）：C 端维护、A/B 端下拉复用；单据冗余存地点文本便于检索。
5. **audit_log 转正**（v1）：所有关键动作双写流水+审计，C 端日志查询（UC-21）数据源。
6. 字段级定义（含非空/默认值）以契约 §2 为准；外键全部建立索引。

## 5. 核心设计：认领单审核状态机

8 状态 12 条迁移 + 1 个自环（VERIFY），事件驱动，迁移规则以表 `(from_state, event) → (to_state, actors, need_comment)` 描述（契约 §5.2）。

设计要点：
- **单一裁决点**：`apply()` 先查终态、再查边、再查角色、再查必填意见；非法迁移抛 40001/40002/40003，机制上杜绝"驳回后再通过"等脏路径。
- **VERIFY 自环（v1）**：身份核验不改状态，只写流水（from=to=APPROVED、verified 真假都记录），避免为核验单独造状态；同时新增不变量 **I7：HANDOVER 前必须存在核验通过流水**，把"防冒领"从口头要求变成代码约束。
- **伴随动作与迁移原子绑定**：通过/交接同步更新物品状态、写流水+审计、发通知，同一事务完成。
- **终态封闭**：四个终态不出现在迁移表 from 列，天然不可再迁移。
- **超时兜底**：待补充、待领取均设 deadline，超时由系统事件 EXPIRE 收敛。

## 6. B 端审核模块详细设计（契约 §3.3，#17~24）

| 接口 | 前置条件 | 后置条件 |
|---|---|---|
| GET /review/queue | reviewer | SUBMITTED+超时 PENDING_INFO，按提交时间升序 |
| POST /claims/{id}/accept | 状态=SUBMITTED | 状态=UNDER_REVIEW，锁定 reviewer_id |
| POST /claims/{id}/verify | 状态=APPROVED 且 reviewer=本人 | 写 VERIFY 流水（不改状态），返回 verified |
| POST /claims/{id}/approve | 状态=UNDER_REVIEW 且 reviewer=本人 | 状态=APPROVED，物品→PICKUP_PENDING |
| POST /claims/{id}/reject | 状态∈{SUBMITTED,UNDER_REVIEW}，comment 必填 | 状态=REJECTED |
| POST /claims/{id}/request-info | 状态=UNDER_REVIEW | 状态=PENDING_INFO，deadline=+7d |
| POST /claims/{id}/handover | 状态=APPROVED 且 **I7 已核验** | 状态=COMPLETED，物品→CLAIMED |
| POST /review/expire-run | — | 超期单置 EXPIRED，物品回退 |

## 7. 安全与异常设计

- 鉴权：登录签发 token；B 端接口统一 reviewer 角色校验（40002），C 端接口 super_admin 校验；账号可被 C 端停用（status=DISABLED 拒绝登录）。
- 越权：申请人只能撤销/补充自己的单据；核验/通过/交接仅限已接单审核员本人。
- 异常：非法迁移 40001、无权限 40002、参数缺失 40003、资源不存在 40401，统一 `{code, message, detail}`。
- 并发：接单依赖状态机判定；生产（MySQL）下接单应改为 `UPDATE claim SET status='UNDER_REVIEW' WHERE id=? AND status='SUBMITTED'` 条件更新，见检查表"已知偏差"。

## 8. 设计取舍记录

| 决策 | 备选 | 取舍理由 |
|---|---|---|
| 事件驱动状态机（迁移表） | if-else 散落在路由 | 迁移集中可测，契约/代码一致性易核对；迁移到 Spring Boot 时为独立构件 |
| VERIFY 自环而非新状态 | 增加 VERIFIED 状态 | 核验不改"可执行事件集合"，加状态徒增两条边；自环+流水同样可审计 |
| 流水表 review_record + audit_log 双写 | 只更新 status | 可追溯、可回放；C 端日志查询有数据源 |
| deadline + 定时任务扫表 | 每单起定时器 | 实现简单，课程场景足够 |
| 双轨交付（方案 C） | 全组改 Python / 重写 Spring Boot | 文档口径统一不返工；原型保底 D2 彩排；24 项冒烟即测试报告素材 |

## 附录 A：FastAPI 原型说明

- 位置：`server/`，5 个 .py + 冒烟脚本，SQLite 单文件，`uvicorn main:app` 直接运行。
- 已实现：契约 #1-24 中的 A/B 端接口（C 端接口未含，属欧阳昊天范围）。
- 验证：`python smoke_test.py` 24 项全绿（输出存档 `测试记录-smoke_test全绿输出.txt`）。
- 迁移到 Spring Boot：models.py→实体+Mapper，state_machine.py→state-machine 构件（原样翻译迁移表），service.py→ReviewService，main.py 路由→Controller；字段与状态机表无需重设计。
