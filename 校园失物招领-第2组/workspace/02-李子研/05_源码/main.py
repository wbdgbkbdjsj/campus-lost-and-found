"""校园失物招领与认领审核系统 · 审核状态流原型 —— FastAPI 入口。

定位（双轨方案 C）：本工程为「B 端审核状态流」的**原型与演示保底**；
正式源码按全组约定（Vue3 + Spring Boot + MySQL）由邓昌兴整合，构件划分与本原型一一对应。

启动： uvicorn main:app --reload
文档： http://127.0.0.1:8000/docs
"""
import csv
import io
import os
import secrets
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

import service
import state_machine as sm
from models import (AuditLog, Category, Claim, FoundItem, Location, LostItem, Notification,
                    ReviewRecord, SessionLocal, User, hash_pwd, init_db, now)

app = FastAPI(title="校园失物招领与认领审核系统 · 审核状态流原型", version="1.1.0")


# ---------------- 基础设施 ----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ok(data=None, message="ok"):
    return {"code": 0, "message": message, "data": data}


@app.exception_handler(sm.DomainError)
def domain_error_handler(_: Request, exc: sm.DomainError):
    status = {40101: 401, 40401: 404}.get(exc.code, 400)
    return JSONResponse(status_code=status,
                        content={"code": exc.code, "message": exc.message, "detail": exc.detail})


@app.exception_handler(RequestValidationError)
def validation_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"code": 40003, "message": "VALIDATION_ERROR",
                                                 "detail": str(exc.errors()[:1])})


# ---------------- 鉴权 ----------------
TOKENS: dict[str, int] = {}


def current_user(db: Session = Depends(get_db), authorization: str = Header(default="")) -> User:
    token = authorization.replace("Bearer ", "").strip()
    uid = TOKENS.get(token)
    user = db.get(User, uid) if uid else None
    if user is None:
        err = sm.DomainError("token 无效或已过期，请重新登录")
        err.code, err.message = 40101, "UNAUTHORIZED"
        raise err
    return user


def reviewer_only(user: User = Depends(current_user)) -> User:
    if user.role != "reviewer":
        raise sm.ForbiddenError("需要审核员(reviewer)权限")
    return user


def super_admin_only(user: User = Depends(current_user)) -> User:
    if user.role != "super_admin":
        raise sm.ForbiddenError("需要超级管理员(super_admin)权限")
    return user


def write_audit(db: Session, actor: User, entity: str, entity_id: int, action: str, detail: str = ""):
    db.add(AuditLog(actor_id=actor.id, entity=entity, entity_id=entity_id,
                    action=action, detail=detail))
    db.commit()


# ---------------- 请求体 ----------------
class LoginIn(BaseModel):
    student_no: str
    password: str


class FoundItemIn(BaseModel):
    title: str
    category_id: int = 1
    description: str = ""
    found_location: str = ""
    found_time: Optional[datetime] = None
    storage_location: str = ""
    image_url: str = ""


class LostItemIn(BaseModel):
    title: str
    category_id: int = 1
    description: str = ""
    lost_location: str = ""
    lost_time: Optional[datetime] = None


class ClaimIn(BaseModel):
    found_item_id: int
    description: str = ""
    proof: str
    contact: str = ""


class SupplementIn(BaseModel):
    proof: str


class ActionIn(BaseModel):
    comment: str = ""


class VerifyIn(BaseModel):
    student_no: str
    name: str


class ExpireIn(BaseModel):
    now: Optional[datetime] = None


class UserStatusIn(BaseModel):
    status: str  # ACTIVE | DISABLED


class CategoryIn(BaseModel):
    name: str
    sort_order: int = 0


class LocationIn(BaseModel):
    name: str
    sort_order: int = 0


# ---------------- 序列化 ----------------
def claim_dict(c: Claim, with_records: bool = False):
    d = {
        "id": c.id, "found_item_id": c.found_item_id, "applicant_id": c.applicant_id,
        "reviewer_id": c.reviewer_id, "status": c.status,
        "status_text": sm.STATES.get(c.status, c.status),
        "allowed_events": sm.allowed_events(c.status),
        "description": c.description, "proof": c.proof, "contact": c.contact,
        "deadline": c.deadline.strftime("%Y-%m-%d %H:%M:%S") if c.deadline else None,
        "submitted_at": c.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if c.submitted_at else None,
        "updated_at": c.updated_at.strftime("%Y-%m-%d %H:%M:%S") if c.updated_at else None,
    }
    if with_records:
        d["records"] = [{
            "action": r.action, "from_status": r.from_status, "to_status": r.to_status,
            "reviewer_id": r.reviewer_id, "comment": r.comment,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None,
        } for r in c.records]
    return d


def item_dict(i: FoundItem):
    return {
        "id": i.id, "title": i.title, "description": i.description,
        "category_id": i.category_id, "found_location": i.found_location,
        "found_time": i.found_time.strftime("%Y-%m-%d %H:%M") if i.found_time else None,
        "storage_location": i.storage_location, "image_url": i.image_url, "status": i.status,
    }


def _get_claim(db: Session, claim_id: int) -> Claim:
    claim = db.get(Claim, claim_id)
    if claim is None:
        raise sm.NotFound(f"claim#{claim_id} 不存在")
    return claim


# ---------------- 认证（契约 #1-3） ----------------
@app.post("/api/v1/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_no == body.student_no).first()
    if user is None or user.password_hash != hash_pwd(body.password):
        raise sm.ValidationFailed("学号或口令错误")
    if user.status != "ACTIVE":
        raise sm.ForbiddenError("账号已被停用")
    token = secrets.token_hex(16)
    TOKENS[token] = user.id
    return ok({"token": token,
               "user": {"id": user.id, "student_no": user.student_no,
                        "name": user.name, "role": user.role}})


@app.get("/api/v1/auth/me")
def me(user: User = Depends(current_user)):
    return ok({"id": user.id, "student_no": user.student_no, "name": user.name, "role": user.role})


# ---------------- 字典（契约 #5-6） ----------------
@app.get("/api/v1/dict/categories")
def dict_categories(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.query(Category).order_by(Category.sort_order).all()
    return ok([{"id": r.id, "name": r.name} for r in rows])


@app.get("/api/v1/dict/locations")
def dict_locations(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.query(Location).order_by(Location.sort_order).all()
    return ok([{"id": r.id, "name": r.name} for r in rows])


# ---------------- 物品（契约 #7-11） ----------------
@app.get("/api/v1/found-items")
def list_found(keyword: str = "", page: int = 1, size: int = 10,
               db: Session = Depends(get_db), _: User = Depends(current_user)):
    q = db.query(FoundItem)
    if keyword:
        q = q.filter(FoundItem.title.contains(keyword))
    total = q.count()
    rows = q.order_by(FoundItem.id.desc()).offset((page - 1) * size).limit(size).all()
    return ok({"total": total, "items": [item_dict(i) for i in rows]})


@app.post("/api/v1/found-items")
def create_found(body: FoundItemIn, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    item = FoundItem(finder_id=user.id, title=body.title, description=body.description,
                     category_id=body.category_id, found_location=body.found_location,
                     found_time=body.found_time or now(), image_url=body.image_url,
                     storage_location=body.storage_location, status="REGISTERED")
    db.add(item)
    db.commit()
    return ok(item_dict(item))


@app.get("/api/v1/found-items/{item_id}")
def get_found(item_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    item = db.get(FoundItem, item_id)
    if item is None:
        raise sm.NotFound(f"found_item#{item_id} 不存在")
    return ok(item_dict(item))


@app.get("/api/v1/lost-items")
def list_lost(db: Session = Depends(get_db), _: User = Depends(current_user)):
    rows = db.query(LostItem).order_by(LostItem.id.desc()).all()
    return ok({"total": len(rows), "items": [
        {"id": r.id, "title": r.title, "description": r.description,
         "category_id": r.category_id, "lost_location": r.lost_location, "status": r.status}
        for r in rows]})


@app.post("/api/v1/lost-items")
def create_lost(body: LostItemIn, db: Session = Depends(get_db),
                user: User = Depends(current_user)):
    row = LostItem(user_id=user.id, title=body.title, description=body.description,
                   category_id=body.category_id, lost_location=body.lost_location,
                   lost_time=body.lost_time or now(), status="OPEN")
    db.add(row)
    db.commit()
    return ok({"id": row.id, "status": row.status})


# ---------------- 认领申请（A 端，契约 #12-16） ----------------
@app.post("/api/v1/claims")
def create_claim(body: ClaimIn, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    claim = service.create_claim(db, user, body.found_item_id, body.description,
                                 body.proof, body.contact)
    return ok(claim_dict(claim), "已提交，等待审核")


@app.get("/api/v1/claims")
def list_claims(scope: str = "mine", db: Session = Depends(get_db),
                user: User = Depends(current_user)):
    q = db.query(Claim)
    if scope == "mine":
        q = q.filter(Claim.applicant_id == user.id)
    elif user.role not in ("reviewer", "super_admin"):
        raise sm.ForbiddenError("仅审核员可查看全部认领单")
    rows = q.order_by(Claim.id.desc()).all()
    return ok({"total": len(rows), "items": [claim_dict(c) for c in rows]})


@app.get("/api/v1/claims/{claim_id}")
def claim_detail(claim_id: int, db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    claim = _get_claim(db, claim_id)
    if user.role not in ("reviewer", "super_admin") and claim.applicant_id != user.id:
        raise sm.ForbiddenError("只能查看自己提交的认领单")
    return ok(claim_dict(claim, with_records=True))


@app.post("/api/v1/claims/{claim_id}/supplement")
def supplement(claim_id: int, body: SupplementIn, db: Session = Depends(get_db),
               user: User = Depends(current_user)):
    claim = _get_claim(db, claim_id)
    return ok(claim_dict(service.supplement(db, claim, user, body.proof)),
              "材料已补充，重新进入审核")


# ---------------- 审核 B 端（契约 #17-24，核心） ----------------
@app.get("/api/v1/review/queue")
def review_queue(db: Session = Depends(get_db), reviewer: User = Depends(reviewer_only)):
    rows = (db.query(Claim).filter(Claim.status.in_(["SUBMITTED", "PENDING_INFO"]))
              .order_by(Claim.submitted_at.asc()).all())
    items = []
    for c in rows:
        d = claim_dict(c)
        wait = int((now() - c.submitted_at).total_seconds() // 60) if c.submitted_at else 0
        applicant = db.get(User, c.applicant_id)
        item = db.get(FoundItem, c.found_item_id)
        d.update({"waiting_minutes": max(wait, 0),
                  "applicant": applicant.name if applicant else "",
                  "title": item.title if item else ""})
        items.append(d)
    return ok({"total": len(items), "items": items})


@app.post("/api/v1/review/claims/{claim_id}/accept")
def accept(claim_id: int, db: Session = Depends(get_db),
           reviewer: User = Depends(reviewer_only)):
    claim = _get_claim(db, claim_id)
    return ok(claim_dict(service.accept(db, claim, reviewer)), "已接单")


@app.post("/api/v1/review/claims/{claim_id}/verify")
def verify(claim_id: int, body: VerifyIn, db: Session = Depends(get_db),
           reviewer: User = Depends(reviewer_only)):
    """身份核验（v1 新增，契约 #19）：不改状态，写 VERIFY 流水；交接前置 I7。"""
    claim = _get_claim(db, claim_id)
    return ok(service.verify(db, claim, reviewer, body.student_no, body.name))


@app.post("/api/v1/review/claims/{claim_id}/approve")
def approve(claim_id: int, body: Optional[ActionIn] = None, db: Session = Depends(get_db),
            reviewer: User = Depends(reviewer_only)):
    claim = _get_claim(db, claim_id)
    comment = body.comment if body else ""
    return ok(claim_dict(service.approve(db, claim, reviewer, comment)), "审核通过")


@app.post("/api/v1/review/claims/{claim_id}/reject")
def reject(claim_id: int, body: ActionIn, db: Session = Depends(get_db),
           reviewer: User = Depends(reviewer_only)):
    claim = _get_claim(db, claim_id)
    return ok(claim_dict(service.reject(db, claim, reviewer, body.comment)), "已驳回")


@app.post("/api/v1/review/claims/{claim_id}/request-info")
def request_info(claim_id: int, body: ActionIn, db: Session = Depends(get_db),
                 reviewer: User = Depends(reviewer_only)):
    claim = _get_claim(db, claim_id)
    return ok(claim_dict(service.request_info(db, claim, reviewer, body.comment)),
              "已退回补充")


@app.post("/api/v1/review/claims/{claim_id}/handover")
def handover(claim_id: int, body: Optional[ActionIn] = None, db: Session = Depends(get_db),
             reviewer: User = Depends(reviewer_only)):
    claim = _get_claim(db, claim_id)
    comment = body.comment if body else ""
    return ok(claim_dict(service.handover(db, claim, reviewer, comment)), "交接完成")


@app.post("/api/v1/review/claims/{claim_id}/cancel")
def cancel(claim_id: int, body: Optional[ActionIn] = None, db: Session = Depends(get_db),
           user: User = Depends(current_user)):
    claim = _get_claim(db, claim_id)
    comment = body.comment if body else ""
    return ok(claim_dict(service.cancel(db, claim, user, comment)), "已撤销")


@app.post("/api/v1/review/expire-run")
def expire_run(body: Optional[ExpireIn] = None, db: Session = Depends(get_db),
               reviewer: User = Depends(reviewer_only)):
    at = body.now if body else None
    ids = service.expire_due(db, at)
    return ok({"expired": len(ids), "ids": ids}, "超时批处理完成")


# ---------------- 通知（契约 #4） ----------------
@app.get("/api/v1/notifications")
def notifications(db: Session = Depends(get_db), user: User = Depends(current_user)):
    rows = (db.query(Notification).filter(Notification.user_id == user.id)
              .order_by(Notification.id.desc()).all())
    return ok({"total": len(rows), "items": [
        {"id": n.id, "title": n.title, "content": n.content, "is_read": n.is_read,
         "created_at": n.created_at.strftime("%Y-%m-%d %H:%M:%S") if n.created_at else None}
        for n in rows]})


# ---------------- 后台管理 C 端（契约 #25-30，super_admin 专用） ----------------
# #25 用户列表
@app.get("/api/v1/admin/users")
def admin_list_users(keyword: str = "", page: int = 1, size: int = 20,
                     admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    q = db.query(User)
    if keyword:
        q = q.filter(User.student_no.contains(keyword) | User.name.contains(keyword))
    total = q.count()
    rows = q.order_by(User.id).offset((page - 1) * size).limit(size).all()
    return ok({"total": total, "items": [{
        "id": u.id, "student_no": u.student_no, "name": u.name,
        "role": u.role, "status": u.status, "phone": u.phone,
        "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else None
    } for u in rows]})


# #26 启用 / 停用账号
@app.put("/api/v1/admin/users/{uid}/status")
def admin_set_user_status(uid: int, body: UserStatusIn,
                          admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    if body.status not in ("ACTIVE", "DISABLED"):
        raise sm.ValidationFailed("status 仅允许 ACTIVE / DISABLED")
    u = db.get(User, uid)
    if u is None:
        raise sm.NotFound(f"user#{uid} 不存在")
    if u.id == admin.id:
        raise sm.ValidationFailed("不能修改自身账号状态")
    if u.role == "super_admin" and body.status == "DISABLED":
        raise sm.ValidationFailed("不能停用其他超级管理员账号")
    u.status = body.status
    db.commit()
    write_audit(db, admin, "user", u.id, "SET_STATUS", f"status={body.status}")
    return ok({"id": u.id, "status": u.status}, "账号状态已更新")


# #27 分类字典维护
@app.get("/api/v1/admin/dict/categories")
def admin_list_categories(admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    rows = db.query(Category).order_by(Category.sort_order).all()
    return ok([{"id": r.id, "name": r.name, "sort_order": r.sort_order} for r in rows])


@app.post("/api/v1/admin/dict/categories")
def admin_create_category(body: CategoryIn,
                          admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise sm.ValidationFailed("分类名称不能为空")
    if db.query(Category).filter(Category.name == name).first():
        raise sm.ValidationFailed("分类名称已存在")
    c = Category(name=name, sort_order=body.sort_order)
    db.add(c); db.commit(); db.refresh(c)
    write_audit(db, admin, "category", c.id, "CREATE", f"name={c.name}")
    return ok({"id": c.id, "name": c.name, "sort_order": c.sort_order}, "分类已新增")


# #28 地点字典维护
@app.get("/api/v1/admin/dict/locations")
def admin_list_locations(admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    rows = db.query(Location).order_by(Location.sort_order).all()
    return ok([{"id": r.id, "name": r.name, "sort_order": r.sort_order} for r in rows])


@app.post("/api/v1/admin/dict/locations")
def admin_create_location(body: LocationIn,
                          admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise sm.ValidationFailed("地点名称不能为空")
    if db.query(Location).filter(Location.name == name).first():
        raise sm.ValidationFailed("地点名称已存在")
    l = Location(name=name, sort_order=body.sort_order)
    db.add(l); db.commit(); db.refresh(l)
    write_audit(db, admin, "location", l.id, "CREATE", f"name={l.name}")
    return ok({"id": l.id, "name": l.name, "sort_order": l.sort_order}, "地点已新增")


# #29 统计看板
@app.get("/api/v1/admin/stats/overview")
def admin_stats(admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    users = db.query(User).all()
    u_total = len(users)
    u_student = sum(1 for u in users if u.role == "student")
    u_reviewer = sum(1 for u in users if u.role == "reviewer")
    u_admin = sum(1 for u in users if u.role == "super_admin")
    u_disabled = sum(1 for u in users if u.status == "DISABLED")

    found = db.query(FoundItem).all()
    lost = db.query(LostItem).all()
    f_claimed = sum(1 for i in found if i.status == "CLAIMED")
    f_registered = sum(1 for i in found if i.status == "REGISTERED")

    claims = db.query(Claim).all()
    c_total = len(claims)
    by_status = {}
    for c in claims:
        by_status[c.status] = by_status.get(c.status, 0) + 1
    completed = by_status.get("COMPLETED", 0)
    expired = by_status.get("EXPIRED", 0)
    pending = by_status.get("SUBMITTED", 0) + by_status.get("PENDING_INFO", 0)
    completion_rate = round(completed / c_total * 100, 1) if c_total else 0.0
    timeout_rate = round(expired / c_total * 100, 1) if c_total else 0.0

    approve_recs = db.query(ReviewRecord).filter(ReviewRecord.action == "APPROVE").all()
    durations = []
    for r in approve_recs:
        c = db.get(Claim, r.claim_id)
        if c and c.submitted_at and r.created_at:
            durations.append((r.created_at - c.submitted_at).total_seconds() / 60)
    avg_review_minutes = round(sum(durations) / len(durations), 1) if durations else 0.0

    return ok({
        "users": {"total": u_total, "student": u_student, "reviewer": u_reviewer,
                  "admin": u_admin, "disabled": u_disabled},
        "items": {"found_total": len(found), "lost_total": len(lost),
                  "found_claimed": f_claimed, "found_registered": f_registered},
        "claims": {"total": c_total, "by_status": by_status,
                   "completed": completed, "expired": expired, "pending": pending},
        "rates": {"completion_rate": completion_rate, "timeout_rate": timeout_rate,
                  "avg_review_minutes": avg_review_minutes},
        "audit_total": db.query(AuditLog).count()
    })


# #30 操作日志 + 认领单 CSV 导出
@app.get("/api/v1/admin/audit-logs")
def admin_audit_logs(entity: str = "", page: int = 1, size: int = 30,
                     admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if entity:
        q = q.filter(AuditLog.entity == entity)
    total = q.count()
    rows = q.order_by(AuditLog.id.desc()).offset((page - 1) * size).limit(size).all()
    return ok({"total": total, "items": [{
        "id": a.id, "actor_id": a.actor_id, "entity": a.entity,
        "entity_id": a.entity_id, "action": a.action, "detail": a.detail,
        "created_at": a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else None
    } for a in rows]})


@app.get("/api/v1/admin/export/claims.csv")
def admin_export_claims(admin: User = Depends(super_admin_only), db: Session = Depends(get_db)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["claim_id", "found_item_id", "applicant_id", "reviewer_id",
                "status", "submitted_at", "updated_at"])
    for c in db.query(Claim).order_by(Claim.id).all():
        w.writerow([c.id, c.found_item_id, c.applicant_id, c.reviewer_id or "",
                    c.status,
                    c.submitted_at.strftime("%Y-%m-%d %H:%M:%S") if c.submitted_at else "",
                    c.updated_at.strftime("%Y-%m-%d %H:%M:%S") if c.updated_at else ""])
    data = buf.getvalue().encode("utf-8-sig")
    return StreamingResponse(iter([data]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=claims.csv"})


# ---------------- 启动 + 种子数据 ----------------
@app.on_event("startup")
def bootstrap():
    init_db()
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            seed(db)
        # 已有库但审计表为空时，补几条代表性日志，避免演示时空白
        if db.query(AuditLog).count() == 0 and db.query(User).count() > 0:
            super1 = db.query(User).filter(User.role == "super_admin").first()
            reviewer = db.query(User).filter(User.role == "reviewer").first()
            first_claim = db.query(Claim).order_by(Claim.id).first()
            if super1 and reviewer and first_claim:
                db.add_all([
                    AuditLog(actor_id=super1.id, entity="system", entity_id=0,
                             action="INIT", detail="系统初始化，载入种子数据"),
                    AuditLog(actor_id=reviewer.id, entity="claim",
                             entity_id=first_claim.id, action="REVIEW_ACCEPT",
                             detail="审核员接单处理"),
                ])
                db.commit()
    finally:
        db.close()


def seed(db: Session):
    from datetime import timedelta
    reviewer = User(student_no="reviewer001", name="李子研", role="reviewer",
                    phone="13800000001", password_hash=hash_pwd("123456"))
    stu1 = User(student_no="stu001", name="王小明", role="student",
                phone="13800000002", password_hash=hash_pwd("123456"))
    stu2 = User(student_no="stu002", name="陈晓", role="student",
                phone="13800000003", password_hash=hash_pwd("123456"))
    super1 = User(student_no="super001", name="管理员", role="super_admin",
                  phone="13800000004", password_hash=hash_pwd("123456"))
    db.add_all([reviewer, stu1, stu2, super1])
    db.flush()

    cats = [Category(name=n, sort_order=i) for i, n in
            enumerate(["证件", "电子设备", "钥匙", "书籍", "日用品", "其他"])]
    locs = [Location(name=n, sort_order=i) for i, n in
            enumerate(["三教", "图书馆", "食堂", "宿舍区", "体育馆", "其他"])]
    db.add_all(cats + locs)
    db.flush()

    items = [
        FoundItem(finder_id=stu2.id, title="黑色雨伞", description="长柄伞，伞柄有白色划痕",
                  category_id=cats[4].id, found_location="三教201",
                  found_time=now() - timedelta(days=1),
                  storage_location="失物招领处 B12 柜", status="CLAIMING"),
        FoundItem(finder_id=stu2.id, title="校园卡（王小明）", description="卡面有轻微磨损",
                  category_id=cats[0].id, found_location="图书馆二楼",
                  found_time=now() - timedelta(days=2),
                  storage_location="失物招领处 B12 柜", status="CLAIMING"),
        FoundItem(finder_id=reviewer.id, title="AirPods 耳机盒", description="白色，无耳机",
                  category_id=cats[1].id, found_location="食堂一楼",
                  found_time=now() - timedelta(days=3),
                  storage_location="失物招领处 B12 柜", status="REGISTERED"),
    ]
    db.add_all(items)
    db.flush()

    c1 = Claim(found_item_id=items[0].id, applicant_id=stu1.id,
               description="11月1日上午在三教201丢的黑色长柄伞",
               proof="伞柄有一道白色划痕，伞骨内侧写有姓名缩写 WXM",
               contact="13800000002", status="SUBMITTED",
               submitted_at=now() - timedelta(minutes=35))
    c2 = Claim(found_item_id=items[1].id, applicant_id=stu1.id,
               description="校园卡在图书馆丢失", proof="卡号后四位 8821，卡套是蓝色",
               contact="13800000002", status="UNDER_REVIEW", reviewer_id=reviewer.id,
               submitted_at=now() - timedelta(hours=2))
    c3 = Claim(found_item_id=items[2].id, applicant_id=stu1.id,
               description="耳机盒在食堂丢失", proof="盒盖内侧有刻字 LY",
               contact="13800000002", status="APPROVED", reviewer_id=reviewer.id,
               submitted_at=now() - timedelta(days=10),
               deadline=now() - timedelta(days=1))
    db.add_all([c1, c2, c3])
    db.flush()

    db.add_all([
        ReviewRecord(claim_id=c1.id, reviewer_id=stu1.id, action="SUBMIT",
                     from_status=None, to_status="SUBMITTED", comment="申请人提交认领申请"),
        ReviewRecord(claim_id=c2.id, reviewer_id=stu1.id, action="SUBMIT",
                     from_status=None, to_status="SUBMITTED", comment="申请人提交认领申请"),
        ReviewRecord(claim_id=c2.id, reviewer_id=reviewer.id, action="ACCEPT",
                     from_status="SUBMITTED", to_status="UNDER_REVIEW", comment="我来处理"),
        ReviewRecord(claim_id=c3.id, reviewer_id=stu1.id, action="SUBMIT",
                     from_status=None, to_status="SUBMITTED", comment="申请人提交认领申请"),
        ReviewRecord(claim_id=c3.id, reviewer_id=reviewer.id, action="ACCEPT",
                     from_status="SUBMITTED", to_status="UNDER_REVIEW", comment=""),
        ReviewRecord(claim_id=c3.id, reviewer_id=reviewer.id, action="APPROVE",
                     from_status="UNDER_REVIEW", to_status="APPROVED", comment="凭证一致"),
        AuditLog(actor_id=super1.id, entity="system", entity_id=0, action="INIT",
                 detail="系统初始化，载入种子数据"),
        AuditLog(actor_id=reviewer.id, entity="claim", entity_id=c1.id, action="REVIEW_ACCEPT",
                 detail="审核员接单处理"),
        AuditLog(actor_id=reviewer.id, entity="claim", entity_id=c3.id, action="REVIEW_APPROVE",
                 detail="凭证一致，审核通过"),
    ])
    db.commit()


# ---------------- 前端静态托管（同源，零 CORS） ----------------
# 只加这一段：业务逻辑（service.py / state_machine.py / models.py）一行未动。
# 挂 /static 而非 /，否则会吞掉 /docs；web/ 目录必须先存在，import 时 StaticFiles 会检查。
WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


@app.get("/", include_in_schema=False)
def web_index():
    return FileResponse(os.path.join(WEB_DIR, "index.html"))
