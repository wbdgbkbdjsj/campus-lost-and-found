# server — B 端审核状态流原型（FastAPI · 演示保底）

> **定位（双轨方案 C）**：正式源码按全组约定 **Vue3 + Spring Boot + MySQL** 由邓昌兴整合；本工程是「B 端审核状态流」的**同构原型**，用于状态流早期验证、冒烟测试与 D2 彩排/答辩现场演示保底。构件与 Spring Boot 版一一对应（见《设计说明书》附录 A）。

## 启动

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
# 打开 http://127.0.0.1:8000/docs 直接调接口
```

首次启动自动建表（9 张）并写入种子数据（`lostfound.db`）。

## 种子账号（v1 三角色）

| 学号 | 口令 | 角色 | 说明 |
|---|---|---|---|
| reviewer001 | 123456 | reviewer | 审核员（B 端） |
| stu001 | 123456 | student | 申请人（有 3 张认领单） |
| stu002 | 123456 | student | 拾获人 |
| super001 | 123456 | super_admin | 超级管理员（C 端，原型仅可登录） |

种子认领单：claim#1 `SUBMITTED`（待接单）、claim#2 `UNDER_REVIEW`（可直接退补/通过）、claim#3 `APPROVED` 且已过 deadline（跑 expire-run 立即失效）。

## 一条命令验证全流程

```bash
python smoke_test.py
```

24 项校验（三角色/字典/主路径/VERIFY 核验/I7 交接前置/终态封闭/权限/超时），全绿即符合契约 v1。全绿输出存档：`../测试记录-smoke_test全绿输出.txt`（可直接作《测试报告》素材）。

## 文件职责 ↔ Spring Boot 构件映射

| 文件 | 职责 | 对应构件 |
|---|---|---|
| `state_machine.py` | 状态机纯逻辑：8 状态 12 迁移表、异常定义 | state-machine 构件（零依赖） |
| `service.py` | 事务边界：迁移落库+审计双写、联动物品、VERIFY 核验、I7 前置、发通知 | review-module / ReviewService |
| `main.py` | 路由 + 三角色鉴权 + 统一错误码 + 种子数据 | Controller 层 |
| `models.py` | 9 张表 ORM | 实体 + Mapper |
| `smoke_test.py` | 冒烟测试/演示脚本 | 测试用例（软件测试 25 分素材） |

## 演示用 curl（v1 关键动作）

```bash
# 审核员登录
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"student_no":"reviewer001","password":"123456"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
AUTH="Authorization: Bearer $TOKEN"

# 队列 → 接单 → 通过 → 身份核验 → 交接
curl -s http://127.0.0.1:8000/api/v1/review/queue -H "$AUTH"
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/accept  -H "$AUTH"
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/approve -H "$AUTH" \
  -H "Content-Type: application/json" -d '{"comment":"凭证一致"}'
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/verify  -H "$AUTH" \
  -H "Content-Type: application/json" -d '{"student_no":"stu001","name":"王小明"}'
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/handover -H "$AUTH"

# 未核验就交接（应 40003，I7）；终态后再通过（应 40001）
# 超时批处理
curl -s -X POST http://127.0.0.1:8000/api/v1/review/expire-run -H "$AUTH"
```

## 重置数据

删除 `server/lostfound.db` 后重启服务，自动重建种子数据。
