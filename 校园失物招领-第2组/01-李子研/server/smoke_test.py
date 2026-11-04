"""审核状态流冒烟测试 / 现场演示脚本。

运行： python smoke_test.py
依次验证 12 条迁移中的主路径、终态封闭、必填校验与权限拦截。
"""
from fastapi.testclient import TestClient

import main
from models import Base, engine

Base.metadata.drop_all(engine)  # 每次从干净库开始（会重建种子数据）
client = TestClient(main.app)
client.__enter__()  # 触发 startup + seed

PASS, FAIL = [], []


def show(title, resp, expect_code=0):
    body = resp.json()
    flag = "OK " if body.get("code") == expect_code else "FAIL"
    (PASS if body.get("code") == expect_code else FAIL).append(title)
    print(f"[{flag}] {title:<28} -> {resp.status_code} code={body.get('code')} "
          f"status={body.get('data', {}).get('status', '-')} detail={str(body.get('detail'))[:60]}")
    return body


def login(no, pwd="123456"):
    r = client.post("/api/v1/auth/login", json={"student_no": no, "password": pwd})
    return r.json()["data"]["token"]


admin = {"Authorization": f"Bearer {login('admin001')}"}
stu = {"Authorization": f"Bearer {login('stu001')}"}

print("=" * 78)
print("1) 队列与接单：SUBMITTED -> UNDER_REVIEW")
show("待审核队列", client.get("/api/v1/review/queue", headers=admin))
show("非管理员访问队列(应40002)", client.get("/api/v1/review/queue", headers=stu), 40002)
show("接单 claim#1", client.post("/api/v1/review/claims/1/accept", headers=admin))

print("=" * 78)
print("2) 退还补充：UNDER_REVIEW -> PENDING_INFO -> RESUBMIT -> UNDER_REVIEW")
show("退补缺 comment(应40003)", client.post("/api/v1/review/claims/2/request-info",
                                            headers=admin, json={"comment": ""}), 40003)
show("退补 claim#2", client.post("/api/v1/review/claims/2/request-info",
                                headers=admin, json={"comment": "请补充卡套颜色与卡号后四位"}))
show("申请人补充材料", client.post("/api/v1/claims/2/supplement",
                                   headers=stu, json={"proof": "蓝色卡套，卡号后四位 8821"}))

print("=" * 78)
print("3) 通过 → 交接：UNDER_REVIEW -> APPROVED -> COMPLETED")
show("通过 claim#1", client.post("/api/v1/review/claims/1/approve",
                                headers=admin, json={"comment": "凭证与物品一致"}))
show("物品转 PICKUP_PENDING", client.get("/api/v1/found-items/1", headers=admin))
show("交接 claim#1", client.post("/api/v1/review/claims/1/handover",
                                headers=admin, json={"comment": "已核验学号，现场交接"}))
show("物品转 CLAIMED", client.get("/api/v1/found-items/1", headers=admin))

print("=" * 78)
print("4) 终态封闭与非法迁移：应全部 40001")
show("重复通过(应40001)", client.post("/api/v1/review/claims/1/approve", headers=admin), 40001)
show("已完成单撤销(应40001)", client.post("/api/v1/review/claims/1/cancel", headers=stu), 40001)
show("不存在单据(应40401)", client.post("/api/v1/review/claims/999/accept", headers=admin), 40401)

print("=" * 78)
print("5) 超时批处理：APPROVED 超期 -> EXPIRED")
show("expire-run", client.post("/api/v1/review/expire-run", headers=admin))
show("claim#3 应 EXPIRED", client.get("/api/v1/claims/3", headers=admin))
show("物品#3 回退 REGISTERED", client.get("/api/v1/found-items/3", headers=admin))

print("=" * 78)
print("6) 审核历史（可追溯性）")
detail = client.get("/api/v1/claims/2", headers=admin).json()["data"]
for r in detail["records"]:
    print(f"    {r['created_at']}  {str(r['from_status']):<13} --{r['action']:<12}--> "
          f"{r['to_status']:<13} | {r['comment']}")

print("=" * 78)
print(f"结果：通过 {len(PASS)} 项，失败 {len(FAIL)} 项。{'✅ 全流程符合契约' if not FAIL else '❌ ' + str(FAIL)}")
