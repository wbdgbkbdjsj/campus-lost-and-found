# 设计模型 08 — 构件图（评分表优秀档点名模型）

> 构件 = 可独立编译/部署、通过接口协作的单元。构件间只依赖接口（ provided / required ），与代码包一一对应。

```mermaid
flowchart LR
    subgraph Frontend["前端构件（Vue3 工程）"]
        FA["构件：app-a<br/>《provided》页面路由/组件<br/>《required》REST /api/v1"]
        FB["构件：app-b 审核工作台<br/>《provided》队列/详情/动作按钮<br/>按钮置灰数据源=allowed_events"]
        FC["构件：app-c 后台管理<br/>《provided》用户/字典/统计/导出"]
    end

    subgraph Backend["后端构件（Spring Boot 模块）"]
        AUTH["构件：auth-module<br/>《provided》/auth/** 登录鉴权<br/>《required》user-mapper"]
        ITEMS["构件：items-module<br/>《provided》/found-items/** /lost-items/** /dict/**"]
        CLAIMS["构件：claims-module<br/>《provided》/claims/** 认领单生命周期"]
        REVIEW["构件：review-module（核心）<br/>《provided》/review/** 审核状态流<br/>《required》state-machine, claims-module, notify-module"]
        NOTIFY["构件：notify-module<br/>《provided》站内通知写入/查询"]
        ADMIN["构件：admin-module<br/>《provided》/admin/** 用户/字典/统计/日志/导出"]
        STM["★构件：state-machine<br/>《provided》apply(state,event,actor)<br/>《provided》allowed_events(state)<br/>纯逻辑·无数据库依赖"]
        SCHED["构件：scheduler<br/>《provided》超时批处理定时入口"]
        MAPPER["构件：persistence<br/>《provided》9 张表 Mapper（MyBatis-Plus）"]
    end

    DB[("MySQL 9 张表")]

    FA & FB & FC --> AUTH
    FA --> ITEMS & CLAIMS
    FB --> REVIEW
    FC --> ADMIN
    REVIEW --> STM
    REVIEW --> NOTIFY
    CLAIMS --> NOTIFY
    CLAIMS --> STM
    SCHED --> REVIEW
    AUTH & ITEMS & CLAIMS & REVIEW & NOTIFY & ADMIN --> MAPPER --> DB
```

构件设计要点：
1. **state-machine 是零依赖纯构件**：不 import 任何数据库/框架类，只提供 `apply()` 与 `allowed_events()`。这让 B 端工作台的"按钮置灰"能直接复用同一份迁移表，前端按钮与后端裁决天然一致。
2. **review-module 是唯一能触发迁移的构件**：claims-module 只能创建/查询/补充，approve/reject 等一律经 review-module。
3. **notify-module 解耦通知**：迁移的伴随动作通过它落通知，后续接短信/邮件只需换实现。
4. **scheduler 与手动 expire-run 复用同一 Service 入口**，答辩演示超时场景不用等定时器。
5. 与《接口-代码检查表》对应：FastAPI 原型中这 6 个后端构件即 main.py / service.py / state_machine.py / models.py 的职责划分，迁移到 Spring Boot 时按包一一对应。
