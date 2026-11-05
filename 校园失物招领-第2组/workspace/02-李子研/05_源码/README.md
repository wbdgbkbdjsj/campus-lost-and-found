# 05_源码 — 可运行交付版（FastAPI 原型 + Vue3 前端演示页）

> **本目录是唯一交付版。** `../server/` 是 v1 契约阶段的原型备份，已冻结，请勿在其中修改代码，避免两份代码分叉。
> 任务 02 的所有改动（前端 `web/` + `main.py` 静态挂载 + 本 README）只落在本目录。
> 唯一口径：`../api-contract-v1.md`；后端业务逻辑 `service.py` / `state_machine.py` / `models.py` **一行未动**。

## 三条命令跑起来

```bash
cd 05_源码
pip install -r requirements.txt
uvicorn main:app --reload
```

首次启动自动建表（9 张）并写入种子数据（生成 `lostfound.db`，可随时删除重建）。

## 前端演示页（零构建）

```text
uvicorn main:app --reload
浏览器打开 http://127.0.0.1:8000/       前端（Vue3，断网可用）
          http://127.0.0.1:8000/docs   接口文档
四个种子账号登录即可按角色进入 A 学生端 / B 审核端 / C 占位页。
截图见 screenshots/，对应《演示脚本-v0.md》15 步。
```

- Vue 3 global build 运行时已本地化到 `web/vendor/vue.global.prod.js`（v3.5.13，MIT，许可文本同目录），**无任何 CDN 外链、无 npm / Vite 构建步骤**，拔网线刷新仍可用。
- 前端由 FastAPI 同源托管在 `/static`，`app.mount("/static")` + 单独 `@app.get("/")`，不会吞掉 `/docs`，零 CORS。
- 后端 `main.py` 只改了 2 处：import 区 3 行、文件末尾静态挂载段；`models.py` / `service.py` / `state_machine.py` / `smoke_test.py` 与 `../server/` **逐字一致**（已用 `cmp` 比对）。

## 目录结构

```text
05_源码/
├── web/
│   ├── index.html                 单页骨架（引用 /static 下本地资源）
│   ├── app.js                     三端菜单 / API 封装 / 12 项页面 / 状态渲染
│   ├── style.css                  投影可读（正文 16px）、零动画
│   └── vendor/
│       ├── vue.global.prod.js     Vue 3.5.13 本地运行时（禁止改 CDN）
│       └── LICENSE-vue.txt        MIT 许可
├── screenshots/                   演示截图（1440×900，均为虚构种子数据）
├── main.py                        +3 行 import、+8 行静态挂载，业务逻辑未动
├── models.py / service.py / state_machine.py / smoke_test.py
├── requirements.txt
└── README.md
```

## 种子账号（v1 三角色，口令均 123456）

| 学号 | 角色 | 登录后菜单 |
|---|---|---|
| `stu001` / `stu002` | `student` | A 学生端：招领列表、拾获登记、物品详情、认领申请、我的认领单、流水与通知 |
| `reviewer001` | `reviewer` | B 审核端：审核队列、认领单详情、身份核验、交接确认、流水与通知 |
| `super001` | `super_admin` | C 占位页（契约 #25-30 已设计、原型未实现，不放假数据） |

角色值只有 `student` / `reviewer` / `super_admin`，`admin` 已废弃。

## 页面 ↔ 演示步 ↔ 接口

| # | 页面 | 演示步 | 接口 |
|---|---|---|---|
| 1 | 登录页 | 1、8 | `POST /auth/login`、`GET /auth/me`（按 `data.user.role` 切菜单） |
| 2 | A 拾获登记 | 2 | `GET /dict/categories`、`/dict/locations`、`POST /found-items`（下拉取字典，不写死） |
| 3 | A 招领列表 / 搜索 | 4 | `GET /found-items?keyword=&page=&size=` |
| 4 | A 物品详情 | 5 | `GET /found-items/{id}` |
| 5 | A 认领申请 | 6 | `POST /claims`（`proof` 前端非空校验，防冒领第一关） |
| 6 | A 我的认领单 | 7、14 | `GET /claims`、`GET /claims/{id}`（回放 records） |
| 7 | B 审核队列 | 8 | `GET /review/queue`（提交时间升序） |
| 8 | B 认领单详情 | 9、10、11 | `accept` / `approve` / `reject` / `request-info` / `handover` / `cancel` / `supplement` |
| 9 | B 身份核验 | 12 | `POST /review/claims/{id}/verify` |
| 10 | B 交接确认 | 13 | `POST /review/claims/{id}/handover` |
| 11 | B/A 流水与通知 | 15 | `GET /claims/{id}`（records）、`GET /notifications` |
| 12 | C 占位页 | — | 无（仅说明，不编数据） |

**主链顺序**：`提交 → 接单 → 审核通过(#20) → 身份核验(#19，APPROVED 自环、不改状态) → 交接(#23，I7 前置)`。
UI 上核验入口出现在「通过」之后、「交接」之前。

## 两个容易踩的实现点（前端已兜住）

1. **按钮显隐取后端 `allowed_events`**：审核/申请人按钮由 `GET /claims/{id}` 返回的 `allowed_events` 推导，前端不重写状态迁移规则。唯一例外是 `VERIFY` —— 它是自环、不进迁移表，后端 `allowed_events` 天然不含它，因此核验**入口**按 `status === 'APPROVED'` 显示，但不参与任何迁移裁决。
2. **错误提示取 `detail`**：后端统一响应为 `{code, message, data}`，异常体为 `{code, message, detail}`。`message` 只是英文枚举（如 `VALIDATION_ERROR`），**中文原因在 `detail`**。页面把三者并列原样显示，所以「未核验点交接」会红字显示 `40003 VALIDATION_ERROR — 交接前必须先通过身份核验（POST /review/claims/{id}/verify）`，不静默失败、不前端禁用按钮。

## 验收记录

```bash
cd 05_源码 && python smoke_test.py     # 24/24 全绿（后端未被碰坏）
```

- **冒烟测试 24/24**：三角色权限、字典、12 条迁移、VERIFY 自环、I7 前置、终态封闭、超时失效、流水可追溯。
- **真实 HTTP 验证 11/11**：`/` 首页、`/docs`、三份 `/static` 资源、登录、`/auth/me`、队列、字典、物品列表全通过；首页无 `http(s)://` 外链。
- **浏览器端到端 15/15**（本机 Chrome 1440×900，真实点击，非静态检查）：三角色菜单切换、队列 → 接单 → 通过 → 核验入口出现在交接前、未核验点交接红显 40003、核验通过 `verified=true`、交接完成 COMPLETED、流水含 `APPROVED → APPROVED` 自环、无 JS 运行时错误。记录见 `../测试记录-前端端到端.txt`。
- `screenshots/` 6 张 1440×900 截图（多一张是为同时留证 COMPLETED 终态与 VERIFY 自环流水），均为种子虚构数据。

> 本轮在 `05_源码/` 复跑冒烟仍 24/24；`../测试记录-smoke_test全绿输出.txt` **未覆盖**，欧阳昊天回填《测试报告》§4 继续用原记录。

> ⚠️ 改动后端任何业务文件都会让 24/24 这份记录失效，欧阳昊天回填《测试报告》§4 用的是这份记录，**请勿覆盖、勿重跑覆盖**。需要修 BUG-003 时另出一条补充测试记录。

## 边界（任务 02 明确别做）

| 别做 | 原因 |
|---|---|
| 重写成 Spring Boot / MySQL | 3 天不够，且会毁掉 24/24 证据；正式栈是文档方案 |
| 改 `service.py` / `state_machine.py` / `models.py` | 已 24/24 全绿，改了要重新验 |
| 改契约 v1 的角色 / 状态 / 接口编号 | 全组材料已按它定稿 |
| 做 C 端 #25-30 的接口或假数据 | 契约 §3.4 属欧阳昊天范围，原型未含 |
| 用 CDN 引 Vue / 依赖 npm 构建 | 断网或答辩机没 Node 就翻车 |

## 任务 02 验收清单（逐条核对）

| # | 任务卡 §7 条目 | 状态 | 依据 |
|---|---|---|---|
| 1 | `python smoke_test.py` 仍 24/24 全绿 | ✅ 已实测 | 交付版目录复跑 24/24，业务文件与 `server/` 逐字一致 |
| 2 | `uvicorn` 后 `/` 出登录页、`/docs` 仍在 | ✅ 已实测 | HTTP 11/11；Chrome dump-dom 确认 Vue 挂载、登录页完整渲染 |
| 3 | 断网刷新仍正常 | ✅ 结构验证 | `index.html` / `app.js` / `style.css` 无任何 `http(s)://` 外链；Vue 运行时本地 157 KB；三份 `/static` 资源均 200。未物理拔网线，答辩机可现场复验 |
| 4 | 四个种子账号都能登录、菜单按 role 切换 | ✅ 已实测 | 4/4 登录返回 token 与正确 role；三角色菜单在浏览器中逐一验证 |
| 5 | 15 步里至少 10 步能点完，主链 6→8→9→11→12→13 全通 | ✅ 主链已实测 | 浏览器真实点击：队列 → 接单 → 通过 → 核验 → 交接 → 流水；A 端登记/详情/认领/我的认领单/通知页面均已实现，未逐步录屏 |
| 6 | 未核验点交接显示 40003 与中文提示 | ✅ 已实测 | 截图 04；`code / message / detail` 三者并列红显，按钮未禁用 |
| 7 | 核验入口在「通过」之后、「交接」之前 | ✅ 已实测 | 端到端第 8 项；主链进度条与卡片顺序一致 |
| 8 | 无 `admin` 角色值、无 C 端假数据、无 v0 口径 | ✅ 已检查 | `grep` 无独立 `admin` 角色值；C 端仅占位说明 |
| 9 | 3–5 张 1440×900 截图、无真实姓名/手机号/学号 | ✅ 6 张 | 全部 1440×900，均为虚构种子数据；多 1 张为同时留证 COMPLETED 与 VERIFY 自环 |
| 10 | 群里回「前端已交 + 24 项仍全绿」 | ⬜ 待本人发 | 话术见下 |

> 关于第 9 条：截图中学号 `stu001 / reviewer001`、手机号 `13800000002` 均为项目虚构种子数据；
> 审核员显示名沿用后端种子里的组员姓名「李子研」。若组长要求完全匿名，需改 `main.py` 种子里的一个字符串
> （会动到交付版 `main.py` 并需重新跑冒烟），本轮按「业务逻辑一行不动」的要求未擅自修改。

**群里回话（可直接复制）**

```
前端已交：05_源码/web 已挂到 FastAPI 同源 /static，Vue3 本地运行时零构建、断网可跑，
uvicorn 起来打开 127.0.0.1:8000/ 就是演示页，/docs 保留。
A/B/C 三端 12 个页面按 15 步做完，主链 提交→接单→通过→身份核验→交接 已用浏览器真点通，
未核验点交接会红显 40003。service.py / state_machine.py 一行没动，python smoke_test.py 仍 24/24 全绿。
截图 6 张在 05_源码/screenshots/，端到端记录在 测试记录-前端端到端.txt。
C 端只留占位，没做假数据。
```
