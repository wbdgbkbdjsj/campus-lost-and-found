# 全组 AI 提示词 + 分工工作量（简洁版）

> 用途：把对应提示词直接转发给那个人，他粘贴到任意 AI 工具即可生成/改造代码。已对齐 v1 口径（角色 `student/reviewer/super_admin`、9 表、8 态、I7）。

---

## 一、5 人 AI 实现提示词

### 李子研（类桌面 AI 工作台 UI）
```
你是前端助手。在 src/lost-found-prototype/web/ 做一个【类桌面 AI 工作台】风格的 Web 界面（纯 Web，不要 Electron）：左侧导航（学生/审核/后台三端入口 + 角色标识）、顶栏（搜索框 + 当前用户）、中间卡片/对话式主区。对接 FastAPI（127.0.0.1:8000）：登录 POST /auth/login（student_no+password，成功 body.code===0）；GET /items、POST /claims、审核通过、身份核验 POST /review/claims/{id}/verify（APPROVED 自环不改状态）、交接 POST /review/claims/{id}/handover（需先核验，I7）。主链跑通且能演示「未核验交接被 40003 拦截」。对齐 model/设计模型/10-用户界面模型.md。产出更新后的 web/ + 6 张截图。不新增接口。
```

### 邓昌兴（Vue Web 对接后端 + 李的 UI）
```
你是 Vue3 助手。改造 lost-found-web 对接 FastAPI（127.0.0.1:8000）并与李子研的 AI 工作台 UI 风格一致。8 处必改（v0→v1）：① vite proxy '/api'→127.0.0.1:8000 且 rewrite /api→/api/v1；② request.ts 成功码 !==0、未登录 40101、提示取 detail；③ constants 角色 STUDENT/AUDITOR/ADMIN→student/reviewer/super_admin；④ auth.ts 字段 username→student_no、/auth/profile→/auth/me；⑤ 路由守卫按 meta.roles 三端隔离；⑥ 复用李的布局组件/配色；⑦ A 端主链页（home/detail/publish/claim-apply/my-claims）从 EmptyState 改真实 el-table/el-form；⑧ 不写假数据。npm run build 通过并截图联调。
```

### 金道轩（演示视频 + 答辩）
```
你是答辩主讲。基于 06_答辩与演示/演示脚本-v0.md（15 步）和答辩题库：① 录 ≤8 分钟演示视频，用李子研跑通的原型照真流程录，必须录到「未核验交接被 40003 拦截」那一帧；② 把脚本/题库里 v0 残留（7 张表 / 三角色大写 / 双人复核 / 扫领取码）改 v1（9 表 / student·reviewer·super_admin / 核验在审核通过后、交接前）；③ 组织全员上台彩排（8+2 分钟），给每人写 1 段讲稿并串场。
```

### 欧阳昊天（测试报告终版 + PPT 同步）
```
你是测试与 PPT 负责人。① 把 04_图表与交叉材料/测试报告-三层测试回填块.md 粘进 02-欧阳昊添/测试报告.md 第 4/5 节转终版（含单元/集成/确认三类 + 24 项实跑结论）；② PPT 里 v0 表述改 v1（9 表、三角色、核验位置）；③ 情况记录表登记的文件名与 校园失物招领-第2组/ 实际目录对齐；④ 宣传彩页已出成品（07_提交包/产品宣传彩页.pdf），你只核对内容。
```

> 阴亮（你）自己统筹，无需提示词。

---

## 二、分工与工作量（直接抄进 QQ 群分工表）

| 姓名 | 分工（写实际做的） | 工作量 |
|---|---|---:|
| 阴亮 | 组长·统筹整合·需求/总体主责·hands-on 整合 Web 端 | 28% |
| 李子研 | 契约+设计+可跑后端+前端+类 AI 工作台 UI | 22% |
| 邓昌兴 | Vue/Spring 工程 + Web 对接基底 | 17% |
| 金道轩 | 演示脚本 + 答辩主讲 + 演示视频 | 16% |
| 欧阳昊天 | 测试报告 + PPT + 情况记录 | 17% |
| **合计** | | **100%** |

**填表 3 条（必看）：**
1. 五数相加 = 100%（不是 1.00）。
2. 每人自评报告里「工作量占比」填同一个数，两边别打架。
3. 阴亮那格写「统筹 + 整合 + 需求/总体主责」，**别写「从零写了 web/窗口程序」**——你做的是 hands-on 整合，如实写更稳。
