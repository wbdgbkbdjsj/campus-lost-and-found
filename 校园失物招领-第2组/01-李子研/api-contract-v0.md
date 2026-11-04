# api-contract-v0.md — 校园失物招领与认领审核系统 · 数据字典 + 接口契约 v0

> 版本：v0（最小可用版：表清单 + 接口路径 + 状态机）
> 维护人：李子研（全组公共前缀，契约冻结前可提修改，冻结后接口一改全返工）
> 状态：**已冻结，后续批次（设计说明书 / 设计模型 / 接口文档 / 编码）均以此为准**

---

## 1. 角色与术语

| 角色 | 说明 |
|---|---|
| user 普通用户 | 提交失物启事 / 拾获登记 / 认领申请 |
| admin 审核员（B 端） | 对认领申请执行审核状态流（接单→审核→通过/驳回→交接） |

| 术语 | 说明 |
|---|---|
| found_item | 拾获登记（别人捡到的物品） |
| lost_item | 失物启事（寻物） |
| claim | 认领申请（本系统核心实体，携带审核状态机） |

---

## 2. 数据字典（表清单）

### 2.1 user 用户表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| student_no | VARCHAR(20) UNIQUE | 学号 |
| name | VARCHAR(50) | 姓名 |
| role | VARCHAR(10) | `user` / `admin` |
| phone | VARCHAR(20) | 联系电话 |
| password_hash | VARCHAR(128) | 口令哈希 |
| created_at | DATETIME | 创建时间 |

### 2.2 lost_item 失物启事表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK→user | 发布人 |
| title / description | VARCHAR | 标题 / 丢失经过描述 |
| category | VARCHAR(20) | 物品分类 |
| lost_location | VARCHAR(100) | 丢失地点 |
| lost_time | DATETIME | 丢失时间 |
| status | VARCHAR(20) | `OPEN` / `MATCHED` / `CLOSED` |
| created_at | DATETIME | 创建时间 |

### 2.3 found_item 拾获物品表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| finder_id | INTEGER FK→user | 拾获人（可为空=代登记） |
| title / description | VARCHAR | 标题 / 物品描述 |
| category | VARCHAR(20) | 物品分类 |
| found_location | VARCHAR(100) | 拾获地点 |
| found_time | DATETIME | 拾获时间 |
| image_url | VARCHAR(255) | 物品照片（可空） |
| storage_location | VARCHAR(100) | 保管位置（如失物招领处 B12 柜） |
| status | VARCHAR(20) | `REGISTERED` → `CLAIMING` → `PICKUP_PENDING` → `CLAIMED`；旁路 `CLOSED` |
| created_at | DATETIME | 创建时间 |

### 2.4 claim 认领申请表（核心）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| found_item_id | INTEGER FK→found_item | 认领的拾获物品 |
| applicant_id | INTEGER FK→user | 申请人 |
| description | VARCHAR(500) | 丢失经过 |
| proof | VARCHAR(500) | 凭证特征描述（颜色/划痕/内容物等） |
| contact | VARCHAR(50) | 联系方式 |
| status | VARCHAR(20) | 审核状态机状态，见 §4 |
| reviewer_id | INTEGER FK→user | 当前审核员（可空） |
| deadline | DATETIME | 待补充/待领取截止时间（可空） |
| submitted_at / updated_at | DATETIME | 提交 / 最近状态变更时间 |

### 2.5 review_record 审核记录表（状态机流水）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| claim_id | INTEGER FK→claim | 关联认领单 |
| reviewer_id | INTEGER FK→user | 操作人 |
| action | VARCHAR(20) | `ACCEPT`/`REQUEST_INFO`/`APPROVE`/`REJECT`/`HANDOVER`/`CANCEL`/`RESUBMIT`/`EXPIRE` |
| from_status / to_status | VARCHAR(20) | 迁移前 / 迁移后状态 |
| comment | VARCHAR(500) | 审核意见（驳回/退补原因） |
| created_at | DATETIME | 操作时间 |

### 2.6 notification 通知表
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| user_id | INTEGER FK→user | 接收人 |
| title / content | VARCHAR | 通知标题 / 内容 |
| is_read | BOOLEAN | 已读标记 |
| created_at | DATETIME | 创建时间 |

### 2.7 audit_log 操作日志表（可选，审计用）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 主键 |
| actor_id | INTEGER | 操作人 |
| entity / entity_id | VARCHAR / INTEGER | 实体类型 / 实体 id |
| action / detail | VARCHAR | 动作 / 明细 |
| created_at | DATETIME | 操作时间 |

---

## 3. 接口路径清单（v0，公共前缀 `/api/v1`）

### 3.1 认证 A 端
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/v1/auth/register | 注册 |
| POST | /api/v1/auth/login | 登录，返回 token |
| GET | /api/v1/auth/me | 当前用户信息 |

### 3.2 物品
| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | /api/v1/found-items | 拾获物品列表 / 登记 |
| GET | /api/v1/found-items/{id} | 拾获物品详情 |
| GET / POST | /api/v1/lost-items | 失物启事列表 / 发布 |
| GET | /api/v1/lost-items/{id} | 失物启事详情 |

### 3.3 认领申请
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /api/v1/claims | 提交认领申请（状态置 SUBMITTED） |
| GET | /api/v1/claims?scope=mine | 我的认领单列表 |
| GET | /api/v1/claims/{id} | 认领单详情（含审核记录） |
| POST | /api/v1/claims/{id}/supplement | 申请人补充材料（PENDING_INFO→UNDER_REVIEW） |

### 3.4 审核 B 端（核心模块）
| 方法 | 路径 | 说明 | 状态迁移 |
|---|---|---|---|
| GET | /api/v1/review/queue | 待审核队列（SUBMITTED+PENDING_INFO 超时单） | — |
| POST | /api/v1/review/claims/{id}/accept | 审核员接单 | SUBMITTED→UNDER_REVIEW |
| POST | /api/v1/review/claims/{id}/approve | 审核通过 | UNDER_REVIEW→APPROVED |
| POST | /api/v1/review/claims/{id}/reject | 驳回（必填原因） | SUBMITTED/UNDER_REVIEW→REJECTED |
| POST | /api/v1/review/claims/{id}/request-info | 退回补充材料 | UNDER_REVIEW→PENDING_INFO |
| POST | /api/v1/review/claims/{id}/handover | 确认现场交接完成 | APPROVED→COMPLETED |
| POST | /api/v1/review/claims/{id}/cancel | 申请人撤销 | 非终态→CANCELLED |
| POST | /api/v1/review/expire-run | 超时批处理（模拟定时任务） | APPROVED 超期→EXPIRED；PENDING_INFO 超期→EXPIRED |

### 3.5 通知
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/v1/notifications | 我的通知列表 |

---

## 4. 认领单审核状态机（v0 粗版）

### 4.1 状态
| 状态码 | 名称 | 终态? |
|---|---|---|
| SUBMITTED | 待审核 | 否 |
| UNDER_REVIEW | 审核中（已接单） | 否 |
| PENDING_INFO | 待补充材料 | 否 |
| APPROVED | 审核通过·待领取 | 否 |
| REJECTED | 已驳回 | 终态 |
| CANCELLED | 已撤销 | 终态 |
| COMPLETED | 已完成（已交接） | 终态 |
| EXPIRED | 已失效（超时） | 终态 |

### 4.2 迁移表（from, event, actor) → to
| from | event | 触发者 | to | 伴随动作 |
|---|---|---|---|---|
| SUBMITTED | ACCEPT | admin | UNDER_REVIEW | 锁定 reviewer |
| SUBMITTED | REJECT | admin | REJECTED | 写审核记录 + 通知 |
| SUBMITTED | CANCEL | applicant | CANCELLED | 通知 |
| UNDER_REVIEW | APPROVE | admin | APPROVED | found_item→PICKUP_PENDING + 通知 |
| UNDER_REVIEW | REJECT | admin | REJECTED | 写记录 + 通知 |
| UNDER_REVIEW | REQUEST_INFO | admin | PENDING_INFO | 设 deadline + 通知 |
| UNDER_REVIEW | CANCEL | applicant | CANCELLED | 通知 |
| PENDING_INFO | RESUBMIT | applicant | UNDER_REVIEW | 校验补充材料非空 |
| PENDING_INFO | CANCEL | applicant | CANCELLED | 通知 |
| PENDING_INFO | EXPIRE | system | EXPIRED | deadline 超时 |
| APPROVED | HANDOVER | admin | COMPLETED | found_item→CLAIMED + 通知 |
| APPROVED | EXPIRE | system | EXPIRED | deadline 超时（默认 7 天未领取） |

规则：
1. 终态（REJECTED/CANCELLED/COMPLETED/EXPIRED）不可再迁移。
2. 一切迁移必须写入 review_record（from→to+action+comment），保证可追溯。
3. 非法迁移（当前状态不允许该事件）返回 `40001 ILLEGAL_TRANSITION`。
4. REJECT 必须携带拒绝原因 comment。

---

## 5. 统一返回结构与错误码

```json
// 成功
{ "code": 0, "message": "ok", "data": { } }
// 失败
{ "code": 40001, "message": "ILLEGAL_TRANSITION", "detail": "..." }
```

| 错误码 | 含义 |
|---|---|
| 0 | 成功 |
| 40001 | 非法状态迁移 |
| 40002 | 无权限（角色不对/非本人单据） |
| 40003 | 参数校验失败（如驳回未填原因） |
| 40401 | 资源不存在 |
| 40101 | 未登录 / token 失效 |

---

## 6. v0 冻结说明
- 本版只约定「表 + 路径 + 状态机」骨架，字段级详细说明与请求/响应示例由批次 1《接口文档.md》细化。
- 状态机若在冻结后调整，须全组同步：影响 ER 图、状态机图、时序图、B 端代码与两份交叉检查表。
