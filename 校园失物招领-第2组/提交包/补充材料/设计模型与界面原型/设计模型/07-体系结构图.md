# 设计模型 07 — 体系结构图（评分表优秀档点名模型）

> 技术口径按全组约定：Vue3 + Spring Boot + MySQL。分层架构 + 三端入口。

```mermaid
flowchart TB
    subgraph Client["客户端层（Vue3 + Element Plus）"]
        WA["A端 Web<br/>失物/认领·学生用"]
        WB["B端 Web<br/>审核工作台·审核员用"]
        WC["C端 Admin<br/>后台管理·超管用"]
    end

    subgraph Gateway["接入层"]
        NG["Nginx 反向代理<br/>静态资源 / API 路由 / 跨域"]
    end

    subgraph App["应用层（Spring Boot 单体，按包分模块）"]
        CT["Controller 层<br/>AuthCtrl · ItemCtrl · ClaimCtrl<br/>ReviewCtrl · AdminCtrl"]
        SV["Service 层<br/>AuthService · ItemService · ClaimService<br/>ReviewService · NotifyService · AdminService"]
        SM["★ 状态机构件<br/>StateMachine（唯一裁决点）"]
        DAO["DAO/Mapper 层<br/>MyBatis-Plus 9 张表 Mapper"]
    end

    subgraph Infra["基础设施层"]
        DB[("MySQL 8.0<br/>9 张表")]
        FS["文件存储<br/>物品照片（本地/OSS）"]
        SCH["@Scheduled 定时任务<br/>expire-run 超时批处理"]
    end

    WA & WB & WC --> NG --> CT
    CT --> SV
    SV --> SM
    SV --> DAO
    DAO --> DB
    SV --> FS
    SCH --> SV
```

体系结构说明（对应评分表"体系结构模型"）：
1. **表现层**：三个 Vue3 入口对应三角色（student/reviewer/super_admin），共用一套登录与通知组件。
2. **业务层**：Controller 只做参数校验与鉴权；Service 承载事务；**状态机为独立构件**，Service 通过它裁决迁移，禁止直接 UPDATE claim.status。
3. **数据层**：MyBatis-Plus 对应契约 9 张表。
4. **横切**：超时批处理为定时任务构件，调用与手动 expire-run 相同的 Service 入口。
