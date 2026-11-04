# 设计模型 06 — 类图（B 端审核模块实现结构，v1）

> v1：角色 `admin`→`reviewer`，ReviewService 新增 `verify()`（身份核验，自环写流水），handover 增加 I7 前置检查。

```mermaid
classDiagram
    class Claim {
        +int id
        +int found_item_id
        +int applicant_id
        +int reviewer_id
        +str status
        +datetime deadline
        +datetime submitted_at
        +datetime updated_at
    }

    class ReviewRecord {
        +int id
        +int claim_id
        +int reviewer_id
        +str action
        +str from_status
        +str to_status
        +str comment
        +datetime created_at
    }

    class FoundItem {
        +int id
        +str title
        +int category_id
        +str storage_location
        +str status
    }

    class Category {
        +int id
        +str name
        +int sort_order
    }

    class Notification {
        +int id
        +int user_id
        +str title
        +str content
        +bool is_read
    }

    class StateMachine {
        +TRANSITIONS dict
        +TERMINAL set
        +can(from_state, event) bool
        +apply(from_state, event, actor, comment) str
        +allowed_events(state) list
    }

    class IllegalTransition
    class ForbiddenError
    class ValidationError

    class ReviewService {
        +accept(claim, reviewer) Claim
        +verify(claim, reviewer, student_no, name) dict
        +approve(claim, reviewer, comment) Claim
        +reject(claim, reviewer, comment) Claim
        +request_info(claim, reviewer, comment) Claim
        +handover(claim, reviewer, comment) Claim
        +cancel(claim, student) Claim
        +expire_due(now) int
        -_persist(claim, action, to_state, comment)$
        -_require_owner(claim, actor)$
        -_require_verified(claim)$
    }

    class ReviewController {
        +get_queue(reviewer)
        +accept(claim_id, reviewer)
        +verify(claim_id, reviewer, student_no, name)
        +approve(claim_id, reviewer, comment)
        +reject(claim_id, reviewer, comment)
        +request_info(claim_id, reviewer, comment)
        +handover(claim_id, reviewer, comment)
        +expire_run()
    }

    ReviewController ..> ReviewService : 调用
    ReviewService ..> StateMachine : apply()
    StateMachine ..> IllegalTransition : 抛出
    ReviewService --> Claim : 更新状态
    ReviewService --> ReviewRecord : 写流水（含VERIFY）
    ReviewService --> FoundItem : 联动状态
    ReviewService --> Notification : 发通知
    Claim "1" --> "*" ReviewRecord : 审核历史
    FoundItem "1" --> "1" Category : 分类
    FoundItem "1" --> "*" Claim : 被认领
```

职责边界：
- `StateMachine`：纯函数式，不碰数据库，只回答"这条边存不存在、谁可触发"；VERIFY 是自环不改状态，因此不进迁移表，由 ReviewService 直接写流水。
- `ReviewService`：事务边界——落库、联动物品状态、写流水、发通知、鉴权（reviewer 本人 + I7 核验前置）。
- `ReviewController`：只做参数与角色校验，异常映射到统一错误码。
