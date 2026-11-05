# 设计模型 01 — ER 图（实体关系，v1 · 9 实体）

> 与 api-contract-v1.md §4 内嵌版同源；字段级定义以契约 §2 为准（含非空/默认值列）。

```mermaid
erDiagram
    USER ||--o{ LOST_ITEM : "发布"
    USER ||--o{ FOUND_ITEM : "拾获登记"
    USER ||--o{ CLAIM : "申请(applicant_id)"
    USER ||--o{ CLAIM : "审核(reviewer_id)"
    USER ||--o{ REVIEW_RECORD : "操作"
    USER ||--o{ NOTIFICATION : "接收"
    USER ||--o{ AUDIT_LOG : "actor"
    CATEGORY ||--o{ LOST_ITEM : "分类"
    CATEGORY ||--o{ FOUND_ITEM : "分类"
    FOUND_ITEM ||--o{ CLAIM : "被认领"
    CLAIM ||--o{ REVIEW_RECORD : "审核流水"

    USER {
        int id PK
        string student_no UK
        string name
        string role "student|reviewer|super_admin"
        string status "ACTIVE|DISABLED"
        string phone
        string password_hash
        datetime created_at
    }
    CATEGORY {
        int id PK
        string name UK
        int sort_order
    }
    LOCATION {
        int id PK
        string name UK
        int sort_order
    }
    LOST_ITEM {
        int id PK
        int user_id FK
        string title
        int category_id FK
        string lost_location
        datetime lost_time
        string status "OPEN|MATCHED|CLOSED"
    }
    FOUND_ITEM {
        int id PK
        int finder_id FK
        string title
        int category_id FK
        string found_location
        datetime found_time
        string image_url
        string storage_location
        string status "REGISTERED|CLAIMING|PICKUP_PENDING|CLAIMED|CLOSED"
    }
    CLAIM {
        int id PK
        int found_item_id FK
        int applicant_id FK
        int reviewer_id FK
        string description
        string proof
        string contact
        string status "状态机8态"
        datetime deadline
        datetime submitted_at
    }
    REVIEW_RECORD {
        int id PK
        int claim_id FK
        int reviewer_id FK
        string action "SUBMIT|ACCEPT|VERIFY|APPROVE|REJECT|REQUEST_INFO|RESUBMIT|HANDOVER|CANCEL|EXPIRE"
        string from_status
        string to_status
        string comment
        datetime created_at
    }
    NOTIFICATION {
        int id PK
        int user_id FK
        string title
        string content
        bool is_read
    }
    AUDIT_LOG {
        int id PK
        int actor_id
        string entity
        int entity_id
        string action
        string detail
    }
```

要点：
- USER 与 CLAIM 存在两条关系（申请人 / 审核员），用两个外键区分。
- CATEGORY/LOCATION 为 v1 新增字典表；location 以地点字典维护为主，单据上冗余存文本便于检索。
- CLAIM↔REVIEW_RECORD 是"当前态 + 流水"组合：回放 REVIEW_RECORD 可重建任意 claim 的状态历史（含 VERIFY 核验记录）。
- AUDIT_LOG 由 C 端"日志查询"消费（UC-21）。
