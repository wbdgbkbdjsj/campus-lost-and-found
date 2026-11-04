# server — B 端审核状态流实现（FastAPI）

## 启动

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
# 打开 http://127.0.0.1:8000/docs 直接调接口
```

首次启动自动建表并写入种子数据（`lostfound.db`）。

## 种子账号

| 学号 | 口令 | 角色 | 说明 |
|---|---|---|---|
| admin001 | 123456 | admin | 审核员（B 端） |
| stu001 | 123456 | user | 申请人（有 3 张认领单） |
| stu002 | 123456 | user | 拾获人 |

种子数据里预置了 3 张不同状态的认领单，方便现场演示：
- claim#1 `SUBMITTED`（待审核，队列里等你接单）
- claim#2 `UNDER_REVIEW`（已接单，可直接退补/通过）
- claim#3 `APPROVED` 且已过 deadline（跑 expire-run 立刻变 EXPIRED）

## 一条命令验证全流程

```bash
python smoke_test.py
```

输出 16 项校验（主路径 / 退补回环 / 终态封闭 / 权限 / 超时），全绿即符合契约。

## 文件职责

| 文件 | 职责 | 关键点 |
|---|---|---|
| `state_machine.py` | 状态机纯逻辑：8 状态 12 条迁移表、异常定义 | 唯一裁决点，不碰数据库 |
| `service.py` | 领域服务：迁移落库、联动物品状态、写流水、发通知、越权校验 | 事务边界；`_persist` 是唯一写状态入口 |
| `main.py` | 路由 + 鉴权 + 统一返回 + 种子数据 | 路由不直接改状态 |
| `models.py` | 7 张表 ORM | 与契约 §2 字段一一对应 |
| `smoke_test.py` | 冒烟测试/演示脚本 | 12 条迁移可达性 |

## 演示用的 curl

```bash
# 审核员登录
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"student_no":"admin001","password":"123456"}' | python -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")

# 队列 → 接单 → 通过 → 交接
curl -s http://127.0.0.1:8000/api/v1/review/queue -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/accept -H "Authorization: Bearer $TOKEN"
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/approve -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"comment":"凭证一致"}'
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/handover -H "Authorization: Bearer $TOKEN"

# 非法迁移（应返回 code 40001）
curl -s -X POST http://127.0.0.1:8000/api/v1/review/claims/1/approve -H "Authorization: Bearer $TOKEN"

# 超时批处理
curl -s -X POST http://127.0.0.1:8000/api/v1/review/expire-run -H "Authorization: Bearer $TOKEN"
```

## 重置数据

删除 `server/lostfound.db` 后重启服务，自动重建种子数据。
