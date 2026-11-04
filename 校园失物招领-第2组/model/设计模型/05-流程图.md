# 设计模型 05 — 流程图（B 端审核处理流程，v1）

> v1：`admin`→`reviewer`；"核验身份"升级为独立接口 VERIFY，并作为交接的强制前置（I7）。

```mermaid
flowchart TD
    Start([审核员登录 B 端]) --> Q[拉取待审核队列<br/>GET /review/queue]
    Q --> Empty{队列为空?}
    Empty -- 是 --> Wait([等待/刷新])
    Empty -- 否 --> Pick[选择一条 SUBMITTED 认领单]
    Pick --> Accept[接单 ACCEPT<br/>SUBMITTED→UNDER_REVIEW]
    Accept --> Guard1{状态机校验通过?}
    Guard1 -- 否 --> Err1[40001 非法迁移] --> Q
    Guard1 -- 是 --> Check[核对申请人凭证<br/>description / proof / 联系方式]
    Check --> Judge{凭证是否充分?}

    Judge -- 不足 --> ReqInfo[退回补充 REQUEST_INFO<br/>comment必填 + deadline+7d]
    ReqInfo --> Notify1[通知申请人] --> WaitSup([等待申请人补充])
    WaitSup --> Sup{7天内补充?}
    Sup -- 否 --> Expire1[EXPIRE 置 EXPIRED 并通知] --> End1([单据关闭])
    Sup -- 是 --> Resub[RESUBMIT 回到 UNDER_REVIEW] --> Check

    Judge -- 充分 --> Approve[审核通过 APPROVE<br/>物品→PICKUP_PENDING<br/>deadline+7d]
    Approve --> Notify2[通知申请人 7 天内领取]
    Notify2 --> WaitPick([申请人现场领取])
    WaitPick --> Pick{7天内到达?}
    Pick -- 否 --> Expire2[EXPIRE 置 EXPIRED<br/>物品回退 REGISTERED] --> End2([物品可再被认领])
    Pick -- 是 --> Verify["身份核验 VERIFY（独立接口）<br/>比对到场 student_no/name 与申请人"]
    Verify --> Ok{核验通过?}
    Ok -- 否 --> RecordF[写 VERIFY 流水 verified=false<br/>拒绝发放，按校规处理] --> WaitPick
    Ok -- 是 --> RecordT[写 VERIFY 流水 verified=true] --> Handover["HANDOVER 确认交接<br/>前置 I7：存在 verified=true 流水<br/>否则 40003"]
    Handover --> Record[物品→CLAIMED + 通知双方]
    Record --> End3([COMPLETED 流程闭环])
```

异常出口：
- 申请人中途撤销 → CANCELLED（非终态任意点均可触发，物品回退 REGISTERED）。
- 认领被驳回 → REJECTED，物品保持可被其他认领单推进。
- 身份核验不通过 → 记录在案（流水 verified=false），不得交接，防冒领。
- 任何非法迁移 → 40001，界面提示"该单据当前状态不支持此操作"（前端按钮置灰数据源 = allowed_events）。
