"""C 端后台管理端 (#25-30) 实机验证：super_admin 可见五管理页，学生越权 40002，自停 40003，CSV 导出。"""
from fastapi.testclient import TestClient
import main
from models import Base, engine, SessionLocal, User

Base.metadata.drop_all(engine)
client = TestClient(main.app)
client.__enter__()


def login(no, pwd="123456"):
    return client.post("/api/v1/auth/login", json={"student_no": no, "password": pwd}).json()["data"]["token"]


sup = {"Authorization": f"Bearer {login('super001')}"}
stu = {"Authorization": f"Bearer {login('stu001')}"}

PASS, FAIL = [], []
def chk(title, resp, expect):
    code = resp.json().get("code")
    ok = code == expect  # 与 smoke_test 一致：比对 body.code（40002 等是业务码，非 HTTP 状态）
    (PASS if ok else FAIL).append(title)
    print(f"[{'OK ' if ok else 'FAIL'}] {title:<34} -> http={resp.status_code} code={code}")

# ---- 管理员可见五管理页 ----
chk("C#25 用户列表", client.get("/api/v1/admin/users", headers=sup), 0)
chk("C#29 统计看板", client.get("/api/v1/admin/stats/overview", headers=sup), 0)
chk("C#27 分类字典列表", client.get("/api/v1/admin/dict/categories", headers=sup), 0)
chk("C#27 分类字典新增", client.post("/api/v1/admin/dict/categories", headers=sup, json={"name": "验证分类", "sort_order": 99}), 0)
chk("C#28 地点字典列表", client.get("/api/v1/admin/dict/locations", headers=sup), 0)
chk("C#28 地点字典新增", client.post("/api/v1/admin/dict/locations", headers=sup, json={"name": "验证地点", "sort_order": 99}), 0)
chk("C#30 操作日志", client.get("/api/v1/admin/audit-logs", headers=sup), 0)
r = client.get("/api/v1/admin/export/claims.csv", headers=sup)
ok_csv = r.status_code == 200 and r.text.startswith("﻿") and "claim" in r.text.lower()
(PASS if ok_csv else FAIL).append("C#30 认领单CSV导出(utf-8-sig)")
print(f"[{'OK ' if ok_csv else 'FAIL'}] {'C#30 认领单CSV导出(utf-8-sig)':<34} -> {r.status_code} head={r.text[:24]!r}")

# ---- 越权与自停校验 ----
chk("学生越权访问管理端(应40002)", client.get("/api/v1/admin/users", headers=stu), 40002)
uid = SessionLocal().query(User).filter(User.student_no == "stu002").first().id
# 用 super001 自身 id 测自停
sup_id = client.get("/api/v1/auth/me", headers=sup).json()["data"]["id"]
chk("管理员停自己(应40003)", client.put(f"/api/v1/admin/users/{sup_id}/status", headers=sup, json={"status": "DISABLED"}), 40003)
chk("管理员停他人(应200)", client.put(f"/api/v1/admin/users/{uid}/status", headers=sup, json={"status": "DISABLED"}), 0)
chk("管理员启用他人(应200)", client.put(f"/api/v1/admin/users/{uid}/status", headers=sup, json={"status": "ACTIVE"}), 0)

print("\n=== C 端验证结果 ===")
print(f"通过 {len(PASS)} 项：{', '.join(PASS)}")
if FAIL:
    print(f"失败 {len(FAIL)} 项：{', '.join(FAIL)}")
else:
    print("✅ C 端 #25-30 全部验证通过（管理员权限最多）")
