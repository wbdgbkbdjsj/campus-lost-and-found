"""审核领域服务 —— 事务边界：迁移落库 + 联动物品状态 + 写流水 + 审计日志 + 发通知 + 越权校验。

v1：角色 student/reviewer/super_admin；新增 verify()（身份核验，APPROVED 自环）；
    handover 强制前置 VERIFY 通过（不变量 I7）；_persist 同步写 audit_log（C 端日志查询数据源）。
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

import state_machine as sm
from models import (AuditLog, Claim, FoundItem, Notification, ReviewRecord,
                    User, now)

GRACE_DAYS = 7  # 待补充 / 待领取的期限


# ---------------- 内部工具 ----------------
def _notify(db: Session, user_id: int, title: str, content: str):
    if not user_id:
        return
    db.add(Notification(user_id=user_id, title=title, content=content))


def _audit(db: Session, actor_id, claim_id: int, action: str, detail: str = ""):
    db.add(AuditLog(actor_id=actor_id or 0, entity="claim", entity_id=claim_id,
                    action=action, detail=detail))


def _persist(db: Session, claim: Claim, event: str, to_state: str,
             actor: User, comment: str = ""):
    """单一落库入口：写 review_record（from→to+action+comment）+ audit_log，并刷新 claim。"""
    db.add(ReviewRecord(
        claim_id=claim.id, reviewer_id=actor.id if actor else None,
        action=event, from_status=claim.status, to_status=to_state,
        comment=(comment or "").strip(), created_at=now(),
    ))
    claim.status = to_state
    claim.updated_at = now()
    _audit(db, actor.id if actor else None, claim.id, event,
           f"{claim.status}->{to_state} {comment}"[:200])


def _require_owner(claim: Claim, actor: User):
    """APPROVE / VERIFY / HANDOVER 仅限已接单的审核员本人。"""
    if claim.reviewer_id and claim.reviewer_id != actor.id:
        raise sm.ForbiddenError(f"该单据已由审核员#{claim.reviewer_id} 接单，你无权处理")


def _require_verified(db: Session, claim: Claim):
    """不变量 I7：交接前必须存在本单 VERIFY 通过流水。"""
    ok = (db.query(ReviewRecord)
            .filter(ReviewRecord.claim_id == claim.id,
                    ReviewRecord.action == "VERIFY",
                    ReviewRecord.comment.like("核验通过%"))
            .first())
    if not ok:
        raise sm.ValidationFailed("交接前必须先通过身份核验（POST /review/claims/{id}/verify）")


def _applicant(db: Session, claim: Claim) -> User:
    return db.get(User, claim.applicant_id)


# ---------------- 提交认领 ----------------
def create_claim(db: Session, applicant: User, found_item_id: int,
                 description: str, proof: str, contact: str) -> Claim:
    item = db.get(FoundItem, found_item_id)
    if item is None:
        raise sm.NotFound(f"拾获物品#{found_item_id} 不存在")
    if item.status not in ("REGISTERED", "CLAIMING"):
        raise sm.ValidationFailed(f"该物品当前状态 {item.status}，不可申请认领")
    if not (proof or "").strip():
        raise sm.ValidationFailed("请填写物品特征凭证，审核时需核对")
    dup = (db.query(Claim)
             .filter(Claim.found_item_id == found_item_id,
                     Claim.applicant_id == applicant.id,
                     Claim.status.in_(["SUBMITTED", "UNDER_REVIEW", "PENDING_INFO", "APPROVED"]))
             .first())
    if dup:
        raise sm.ValidationFailed(f"你已提交过该物品的认领申请（#{dup.id}，{dup.status}），请勿重复提交")

    claim = Claim(found_item_id=found_item_id, applicant_id=applicant.id,
                  description=description, proof=proof, contact=contact,
                  status="SUBMITTED", submitted_at=now(), updated_at=now())
    db.add(claim)
    db.flush()
    db.add(ReviewRecord(claim_id=claim.id, reviewer_id=applicant.id, action="SUBMIT",
                        from_status=None, to_status="SUBMITTED",
                        comment="申请人提交认领申请", created_at=now()))
    _audit(db, applicant.id, claim.id, "SUBMIT", f"对物品#{found_item_id} 提交认领")
    item.status = "CLAIMING"
    db.commit()
    return claim


# ---------------- 审核动作 ----------------
def accept(db: Session, claim: Claim, reviewer: User) -> Claim:
    to_state = sm.apply(claim.status, "ACCEPT", "reviewer", comment="")
    claim.reviewer_id = reviewer.id
    _persist(db, claim, "ACCEPT", to_state, reviewer)
    _notify(db, claim.applicant_id, "认领申请已被受理",
            f"你的认领申请（#{claim.id}）已由审核员受理，正在审核中。")
    db.commit()
    return claim


def verify(db: Session, claim: Claim, reviewer: User, student_no: str, name: str) -> dict:
    """身份核验（APPROVED 自环）：比对到场人与申请人，不改状态，只写 VERIFY 流水。"""
    _require_owner(claim, reviewer)
    if claim.status != "APPROVED":
        raise sm.IllegalTransition(f"仅 APPROVED 状态可进行身份核验，当前 {claim.status}")
    if not (student_no or "").strip() or not (name or "").strip():
        raise sm.ValidationFailed("请输入到场人学号与姓名")
    applicant = _applicant(db, claim)
    matched = (applicant is not None
               and applicant.student_no == (student_no or "").strip()
               and applicant.name == (name or "").strip())
    comment = f"核验通过：学号/姓名与申请人一致" if matched else \
              f"核验不通过：到场人 {student_no}/{name} 与申请人 {applicant.student_no if applicant else '?'}/{applicant.name if applicant else '?'} 不一致"
    db.add(ReviewRecord(claim_id=claim.id, reviewer_id=reviewer.id, action="VERIFY",
                        from_status=claim.status, to_status=claim.status,
                        comment=comment, created_at=now()))
    _audit(db, reviewer.id, claim.id, "VERIFY", comment[:200])
    if not matched:
        _notify(db, claim.applicant_id, "身份核验未通过",
                "现场核验信息与申请人不一致，请核对后重新到场领取。")
    db.commit()
    return {"verified": matched, "comment": comment}


def approve(db: Session, claim: Claim, reviewer: User, comment: str = "") -> Claim:
    _require_owner(claim, reviewer)
    to_state = sm.apply(claim.status, "APPROVE", "reviewer", comment)
    deadline = now() + timedelta(days=GRACE_DAYS)
    claim.deadline = deadline
    _persist(db, claim, "APPROVE", to_state, reviewer, comment)

    item = db.get(FoundItem, claim.found_item_id)
    if item:
        item.status = "PICKUP_PENDING"
        where = item.storage_location or "失物招领处"
    else:
        where = "失物招领处"
    _notify(db, claim.applicant_id, "认领审核通过",
            f"请于 {deadline:%Y-%m-%d %H:%M} 前携带学生证到 {where} 领取，逾期自动失效。")
    db.commit()
    return claim


def reject(db: Session, claim: Claim, reviewer: User, comment: str) -> Claim:
    to_state = sm.apply(claim.status, "REJECT", "reviewer", comment)
    _persist(db, claim, "REJECT", to_state, reviewer, comment)

    item = db.get(FoundItem, claim.found_item_id)
    if item and item.status == "CLAIMING":
        item.status = "REGISTERED"  # 物品可被其他认领单推进
    _notify(db, claim.applicant_id, "认领申请被驳回", f"驳回原因：{comment.strip()}")
    db.commit()
    return claim


def request_info(db: Session, claim: Claim, reviewer: User, comment: str) -> Claim:
    _require_owner(claim, reviewer)
    to_state = sm.apply(claim.status, "REQUEST_INFO", "reviewer", comment)
    deadline = now() + timedelta(days=GRACE_DAYS)
    claim.deadline = deadline
    _persist(db, claim, "REQUEST_INFO", to_state, reviewer, comment)
    _notify(db, claim.applicant_id, "认领材料需补充",
            f"{comment.strip()}（请于 {deadline:%Y-%m-%d %H:%M} 前补充，逾期失效）")
    db.commit()
    return claim


def handover(db: Session, claim: Claim, reviewer: User, comment: str = "") -> Claim:
    _require_owner(claim, reviewer)
    _require_verified(db, claim)  # 不变量 I7：先核验后交接
    to_state = sm.apply(claim.status, "HANDOVER", "reviewer", comment)
    claim.deadline = None
    _persist(db, claim, "HANDOVER", to_state, reviewer, comment)

    item = db.get(FoundItem, claim.found_item_id)
    if item:
        item.status = "CLAIMED"
    _notify(db, claim.applicant_id, "失物已交接",
            f"认领申请（#{claim.id}）已完成交接，物品已归还，流程结束。")
    if item and item.finder_id:
        _notify(db, item.finder_id, "你拾获的物品已被认领",
                f"{item.title} 已完成交接，感谢你的拾金不昧。")
    db.commit()
    return claim


def cancel(db: Session, claim: Claim, student: User, comment: str = "") -> Claim:
    if claim.applicant_id != student.id:
        raise sm.ForbiddenError("只能撤销自己提交的认领申请")
    to_state = sm.apply(claim.status, "CANCEL", "student", comment)
    _persist(db, claim, "CANCEL", to_state, student, comment)

    item = db.get(FoundItem, claim.found_item_id)
    if item and item.status in ("CLAIMING", "PICKUP_PENDING"):
        item.status = "REGISTERED"
    if claim.reviewer_id:
        _notify(db, claim.reviewer_id, "申请人撤销了认领",
                f"认领单#{claim.id} 已被申请人撤销，无需继续处理。")
    db.commit()
    return claim


def supplement(db: Session, claim: Claim, student: User, proof: str) -> Claim:
    if claim.applicant_id != student.id:
        raise sm.ForbiddenError("只能补充自己的认领材料")
    if not (proof or "").strip():
        raise sm.ValidationFailed("补充材料不能为空")
    to_state = sm.apply(claim.status, "RESUBMIT", "student")
    claim.proof = proof.strip()
    claim.deadline = None
    _persist(db, claim, "RESUBMIT", to_state, student, "申请人补充了凭证材料")
    _notify(db, claim.reviewer_id or 0, "申请人补充了材料",
            f"认领单#{claim.id} 已补充凭证，请继续审核。")
    db.commit()
    return claim


# ---------------- 超时批处理 ----------------
def expire_due(db: Session, at: datetime = None) -> list:
    """把 PENDING_INFO / APPROVED 超期单据收敛到 EXPIRED（系统事件）。"""
    at = at or now()
    due = (db.query(Claim)
             .filter(Claim.status.in_(["PENDING_INFO", "APPROVED"]),
                     Claim.deadline.isnot(None),
                     Claim.deadline < at)
             .all())
    ids = []
    for claim in due:
        prev = claim.status
        to_state = sm.apply(prev, "EXPIRE", "system")
        _persist(db, claim, "EXPIRE", to_state, None,
                 f"超过截止时间（{claim.deadline:%Y-%m-%d %H:%M}）自动失效")
        item = db.get(FoundItem, claim.found_item_id)
        if item and prev == "APPROVED" and item.status == "PICKUP_PENDING":
            item.status = "REGISTERED"
        _notify(db, claim.applicant_id, "认领申请已失效",
                "因超时未处理，本次认领申请已自动失效，如仍需认领请重新提交。")
        ids.append(claim.id)
    db.commit()
    return ids
