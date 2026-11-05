# 设计模型 03 — 用例图（v1 · 三角色）

> v1：角色 `user`→`student`、`admin`→`reviewer`，补 C 端 `super_admin` 用例（对齐组内用例图 UC-18~21）。

```mermaid
flowchart LR
    subgraph 系统: 校园失物招领与认领审核系统
        UC1((注册/登录))
        UC2((发布失物启事))
        UC3((登记拾获物品))
        UC4((提交认领申请))
        UC5((补充凭证材料))
        UC6((撤销认领申请))
        UC13((查看通知/审核记录))
        UC7((查看审核队列))
        UC8((接单))
        UC14((身份核验))
        UC9((审核通过/驳回))
        UC10((退回补充材料))
        UC11((确认交接完成))
        UC12((超时失效处理))
        UC18((用户管理/停启用))
        UC19((分类/地点字典维护))
        UC20((统计看板))
        UC21((日志查询/Excel导出))
    end

    Student([学生 student])
    Reviewer([审核员 reviewer])
    SuperAdmin([超级管理员 super_admin])
    System([定时任务/系统])

    Student --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC13
    Reviewer --> UC1 & UC7 & UC8 & UC14 & UC9 & UC10 & UC11 & UC13
    SuperAdmin --> UC1 & UC18 & UC19 & UC20 & UC21
    System --> UC12

    UC4 -.include.-> UC1
    UC9 -.extend.-> UC10 : 凭证不足时
    UC11 -.include.-> UC14 : 交接前必须核验 I7
```

说明：
- 学生（A 端）核心链路：提交认领（UC4）→ 补充（UC5）/ 撤销（UC6）。
- 审核员（B 端，本模块）：队列（UC7）→ 接单（UC8）→ **身份核验（UC14，v1 新增独立用例）**→ 通过/驳回（UC9）/ 退补（UC10）→ 交接（UC11）。
- 超级管理员（C 端，欧阳昊天）：用户管理、字典、统计、日志导出（UC-18~21），不参与单据审核流。
