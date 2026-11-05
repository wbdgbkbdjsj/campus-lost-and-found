# README

# C 后台端｜校园失物招领与认领审核系统

> 负责人：欧阳昊天　版本：v1.0　日期：2026-11-04
> 契约依据：`api-contract-v0.md`（已冻结）

## 1. 定位：C 端和 B 端的边界

三端容易做重，先划清：**B 端是审核员处理单据（接单→通过/驳回→交接），C 端是运营维护台账、盯积压、跑批处理。** 同一张单据，B 端关心"这一单怎么判"，C 端关心"今天积压了多少、有没有超时没人管"。

| 端 | 角色 | 核心页面 | 主要动作 |
| --- | --- | --- | --- |
| A 学生端 | user | 发布、搜索、认领 | 提交申请、补充材料 |
| B 审核端 | admin | 审核队列 → 单据详情 | ACCEPT / APPROVE / REJECT / REQUEST\_INFO / HANDOVER |
| **C 后台端** | admin | 工作台、物品台账、积压监控、批处理 | 代登记、查台账、盯积压、触发超时批处理、看通知 |

## 2. 接口对照（全部落在契约内，未自行新增）

| 页面 | 用到的契约接口 | 说明 |
| --- | --- | --- |
| 工作台 | GET `/found-items`、GET `/lost-items`、GET `/review/queue`、GET `/notifications` | 无统计接口，前端用各列表返回的 `total` 聚合 |
| 物品台账 | GET `/found-items`、GET `/found-items/{id}`、POST `/found-items` | 含 admin 代登记（`finder_id` 留空） |
| 积压监控 | GET `/review/queue` | 前端按 `submitted_at` 算等待时长并标红 |
| 批处理 | POST `/review/expire-run` | C 端主责，后端 `ExpireServiceImpl` 实现 |

### 2.1 需要契约补充的接口（已列出，未擅自实现）

契约 v0 只给了 `GET /claims?scope=mine`，admin 看不到全量单据。C 端以下功能因此**先不做**，等李子研在《接口文档.md》里补：

| 待补接口 | 用途 | 影响页面 |
| --- | --- | --- |
| `GET /api/v1/claims?scope=all&status=&page=&size=` | 全量认领单查询与筛选 | 后台「认领单管理」整页 |
| `GET /api/v1/admin/stats/overview` | 工作台指标一次性返回，避免前端拉 4 个列表 | 工作台指标卡 |
| `PATCH /api/v1/notifications/{id}/read` | 通知已读（契约有字段无接口） | 通知中心红点 |

> 这三条已同步进 `测试用例表.md` 第 11 节 Q10 与 `测试报告.md` 5.1。**在补齐前，前端把对应入口做成禁用态并标注「待接口」，而不是偷偷用别的方式绕过**——绕过会在演示时暴露。

## 3. 目录结构

```
C后台端/
├── backend/
│   ├── controller/
│   │   ├── ExpireController.java           # POST /review/expire-run
│   │   └── FoundItemAdminController.java   # 台账查询 + 代登记（复用契约路径）
│   ├── service/
│   │   ├── ExpireService.java
│   │   └── impl/ExpireServiceImpl.java     # 核心：超时扫描 + 状态迁移 + 流水 + 通知
│   ├── mapper/
│   │   ├── ClaimMapper.java                # claim 查询与条件更新
│   │   ├── FoundItemAdminMapper.java       # 台账分页、详情、代登记
│   │   ├── AuditTrailMapper.java           # 审核流水 / 通知 / 物品状态回落
│   │   └── xml/ClaimMapper.xml
│   ├── entity/
│   │   ├── Claim.java
│   │   └── FoundItem.java
│   └── dto/
│       ├── ExpireResultVO.java
│       └── FoundItemSaveReq.java
└── frontend/
    ├── api/admin.js
    ├── router/admin.routes.js
    ├── components/StatusTag.vue
    └── views/admin/
        ├── Dashboard.vue       # 工作台
        ├── ItemLedger.vue      # 物品台账（含代登记）
        ├── BacklogMonitor.vue  # 积压监控
        └── BatchPanel.vue      # 超时批处理
```

### 3.1 依赖公共模块（不重复造，由邓昌兴提供）

代码里用到两个公共类，本目录**没有**包含，避免与骨架撞车：

| 类 | 需要的静态方法 | 用途 |
| --- | --- | --- |
| `com.lostfound.common.R` | `R.ok(data)`、`R.fail(code, message)` | 统一返回 `{code, message, data}` |
| `com.lostfound.common.PageResult` | `PageResult.of(rows, total, page, size)` | 分页结构 |

若骨架里的类名或包路径不同，改 Controller 的 import 即可，业务代码不用动。

## 4. 并入邓昌兴骨架

后端（包名 `com.lostfound`，如有出入按骨架改 import）：

1. `backend/` 下四个包整体拷到 `src/main/java/com/lostfound/modules/admin/`。
2. `xml/ClaimMapper.xml` 放到 `src/main/resources/mapper/`，`application.yml` 里 `mybatis-plus.mapper-locations` 需含 `classpath*:mapper/*.xml`。
3. 两个 Controller 的方法都已在契约路径上，**不要加新的 **`@RequestMapping`** 前缀**，否则路径变成 `/api/v1/admin/review/expire-run`，与契约不符。

前端：

1. `frontend/` 并入 `src/`，页面路径 `src/views/admin/`。
2. `router/admin.routes.js` 里的数组展开进 `router/index.js` 的 routes，父路由 `/admin` 加 `meta.roles: ['admin']`。
3. 依赖：`element-plus`、`axios`、`dayjs`。`api/admin.js` 里的 `request` 用骨架的 axios 实例替换。

## 5. 已实现 / 未实现

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 超时批处理（`expire-run`） | ✅ 完整 | 两类超时、条件更新防并发、写流水、发通知、返回统计 |
| 物品台账 + 代登记 | ✅ 完整 | 复用契约接口，`finder_id` 可空 |
| 积压监控 | ✅ 完整 | 等待时长排序、超时标红、一键跳 B 端处理 |
| 工作台 | ✅ 可用 | 指标由 4 个列表聚合，接口补齐后可换单接口 |
| 全量认领单管理 | ⛔ 待契约 | 缺 `scope=all`，入口禁用 |
| 用户 / 分类维护 | ⛔ 未做 | 契约无对应表与接口，属范围外 |
| 通知已读 | ⛔ 待契约 | 缺 `PATCH /notifications/{id}/read` |

## 6. 自测记录

| 项 | 方式 | 结果 |
| --- | --- | --- |
| 批处理幂等 | 连续调 2 次 `expire-run` | 第 2 次 `expired=0`，无重复流水 |
| 批处理防并发 | 两个请求同时打 | 条件更新只放行一方，流水无重复 |
| 代登记 | `finder_id` 传 null | 落库为空，`storage_location` 正常 |
| 空队列 | 队列为空时进积压页 | 显示空状态，不报错 |
| 权限 | user token 调 `expire-run` | 40002，拦截在后端而非仅前端隐藏 |

> 以上为本地自测。正式结果以 `测试报告.md` R1/R2 轮次回填为准。
