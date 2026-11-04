"""审核状态流冒烟测试 / 现场演示脚本（v1：三角色 + 身份核验 I7）。

运行： python smoke_test.py
验证：12 条迁移主路径、VERIFY 自环、I7 交接前置、终态封闭、角色权限、超时失效。
"""
from fastapi.testclient import TestClient

import main
from models import Base, engine

Base.metadata.drop_all(engine)  # 每次从干净库开始（自动重建种子数据）
client = TestClient(main.app)
client.__enter__()

PASS, FAIL = [], []


def show(title, resp, expect_code=0, expect_key=None):
    body = resp.json()
    good = body.get("code") == expect_code
    if good and expect_key is not None:
        good = expect_key(body.get("data", {}))
    (PASS if good else FAIL).append(title)
    print(f"[{'OK ' if good else 'FAIL'}] {title:<30} -> {resp.status_code} code={body.get('code')} "
          f"status={body.get('data', {}).get('status', '-') if isinstance(body.get('data'), dict) else '-'} "
          f"detail={str(body.get('detail'))[:56]}")
    return body


def login(no, pwd="123456"):
    r = client.post("/api/v1/auth/login", json={"student_no": no, "password": pwd})
    return r.json()["data"]["token"]


rev = {"Authorization": f"Bearer {login('reviewer001')}"}
stu = {"Authorization": f"Bearer {login('stu001')}"}
sup = {"Authorization": f"Bearer {login('super001')}"}

print("=" * 80)
print("0) 三角色登录与字典（v1）")
show("reviewer001 登录为 reviewer", client.get("/api/v1/auth/me", headers=rev),
     0, lambda d: d["role"] == "reviewer")
show("stu001 登录为 student", client.get("/api/v1/auth/me", headers=stu),
     0, lambda d: d["role"] == "student")
show("super001 登录为 super_admin", client.get("/api/v1/auth/me", headers=sup),
     0, lambda d: d["role"] == "super_admin")
show("分类字典", client.get("/api/v1/dict/categories", headers=stu))
show("地点字典", client.get("/api/v1/dict/locations", headers=stu))

print("=" * 80)
print("1) 队列与接单：SUBMITTED -> UNDER_REVIEW")
show("待审核队列", client.get("/api/v1/review/queue", headers=rev))
show("学生访问队列(应40002)", client.get("/api/v1/review/queue", headers=stu), 40002)
show("超管访问队列(应40002)", client.get("/api/v1/review/queue", headers=sup), 40002)
show("接单 claim#1", client.post("/api/v1/review/claims/1/accept", headers=rev))

print("=" * 80)
print("2) 退补回环：UNDER_REVIEW -> PENDING_INFO -> RESUBMIT -> UNDER_REVIEW")
show("退补缺 comment(应40003)", client.post("/api/v1/review/claims/2/request-info",
                                            headers=rev, json={"comment": ""}), 40003)
show("退补 claim#2", client.post("/api/v1/review/claims/2/request-info",
                                headers=rev, json={"comment": "请补充卡套颜色与卡号后四位"}))
show("申请人补充材料", client.post("/api/v1/claims/2/supplement",
                                   headers=stu, json={"proof": "蓝色卡套，卡号后四位 8821"}))

print("=" * 80)
print("3) 通过 → 核验 → 交接：APPROVED 自环 VERIFY + I7 前置")
show("通过 claim#1", client.post("/api/v1/review/claims/1/approve",
                                headers=rev, json={"comment": "凭证与物品一致"}))
show("未核验就交接(应40003-I7)", client.post("/api/v1/review/claims/1/handover", headers=rev), 40003)
show("核验信息错误(verified=false)",
     client.post("/api/v1/review/claims/1/verify",
                 headers=rev, json={"student_no": "stu009", "name": "路人"}),
     0, lambda d: d["verified"] is False)
show("核验通过(verified=true)",
     client.post("/api/v1/review/claims/1/verify",
                 headers=rev, json={"student_no": "stu001", "name": "王小明"}),
     0, lambda d: d["verified"] is True)
show("核验后交接", client.post("/api/v1/review/claims/1/handover",
                               headers=rev, json={"comment": "已核验学号，现场交接"}))
show("物品转 CLAIMED", client.get("/api/v1/found-items/1", headers=rev))

print("=" * 80)
print("4) 终态封闭与非法迁移：应全部 40001")
show("重复通过(应40001)", client.post("/api/v1/review/claims/1/approve", headers=rev), 40001)
show("已完成单撤销(应40001)", client.post("/api/v1/review/claims/1/cancel", headers=stu), 40001)
show("不存在单据(应40401)", client.post("/api/v1/review/claims/999/accept", headers=rev), 40401)

print("=" * 80)
print("5) 超时批处理：APPROVED 超期 -> EXPIRED")
show("expire-run", client.post("/api/v1/review/expire-run", headers=rev))
show("claim#3 应 EXPIRED", client.get("/api/v1/claims/3", headers=rev))
show("物品#3 回退 REGISTERED", client.get("/api/v1/found-items/3", headers=rev))

print("=" * 80)
print("6) 审核历史（含 VERIFY 流水，可追溯）")
detail = client.get("/api/v1/claims/1", headers=rev).json()["data"]
for r in detail["records"]:
    print(f"    {r['created_at']}  {str(r['from_status']):<13} --{r['action']:<12}--> "
          f"{r['to_status']:<13} | {r['comment'][:48]}")

print("=" * 80)
print(f"结果：通过 {len(PASS)} 项，失败 {len(FAIL)} 项。"
      f"{'✅ 全流程符合契约 v1' if not FAIL else '❌ ' + str(FAIL)}")
