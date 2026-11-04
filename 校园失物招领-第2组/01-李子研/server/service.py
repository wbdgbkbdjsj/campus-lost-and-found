"""审核领域服务 —— 事务边界：迁移落库 + 联动物品状态 + 写流水 + 发通知 + 越权校验。"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

import state_machine as sm
from models import Claim, FoundItem, Notification, ReviewRecord, User, now

GRACE_DAYS = 7  # 待补充 / 待领取的期限


# ---------------- 内部工具 ----------------
def _notify(db: Session, user_id: int, title: str, content: str):
    if not user_id:
        return
    db.add(Notification(user_id=user_id, title=title, content=content))


def _persist(db: Session, claim: Claim, event: str, to_state: str,
             actor: User, comment: str = ""):
    """单一落库入口：写 review_record（from→to+action+comment）并刷新 claim。"""
    db.add(ReviewRecord(
        claim_id=claim.id, reviewer_id=actor.id if actor else None,
        action=event, from_status=claim.status, to_status=to_state,
        comment=(comment or "").strip(), created_at=now(),
    ))
    claim.status = to_state
    claim.updated_at = now()


def _require_owner(claim: Claim, actor: User):
    """APPROVE / HANDOVER 仅限已接单的审核员本人。"""
    if claim.reviewer_id and claim.reviewer_id != actor.id:
        raise sm.ForbiddenError(f"该单据已由审核员#{claim.reviewer_id} 接单，你无权处理")


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
    item.status = "CLAIMING"
    db.commit()
    return claim


# ---------------- 审核动作 ----------------
def accept(db: Session, claim: Claim, admin: User) -> Claim:
    to_state = sm.apply(claim.status, "ACCEPT", "admin",
                        comment="")
    claim.reviewer_id = admin.id
    _persist(db, claim, "ACCEPT", to_state, admin)
    _notify(db, claim.applicant_id, "认领申请已被受理",
            f"你的认领申请（#{claim.id}）已由审核员受理，正在审核中。")
    db.commit()
    return claim


def approve(db: Session, claim: Claim, admin: User, comment: str = "") -> Claim:
    _require_owner(claim, admin)
    to_state = sm.apply(claim.status, "APPROVE", "admin", comment)
    deadline = now() + timedelta(days=GRACE_DAYS)
    claim.deadline = deadline
    _persist(db, claim, "APPROVE", to_state, admin, comment)

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


def reject(db: Session, claim: Claim, admin: User, comment: str) -> Claim:
    to_state = sm.apply(claim.status, "REJECT", "admin", comment)
    _persist(db, claim, "REJECT", to_state, admin, comment)

    item = db.get(FoundItem, claim.found_item_id)
    if item and item.status == "CLAIMING":
        item.status = "REGISTERED"  # 物品可被其他认领单推进
    _notify(db, claim.applicant_id, "认领申请被驳回", f"驳回原因：{comment.strip()}")
    db.commit()
    return claim


def request_info(db: Session, claim: Claim, admin: User, comment: str) -> Claim:
    _require_owner(claim, admin)
    to_state = sm.apply(claim.status, "REQUEST_INFO", "admin", comment)
    deadline = now() + timedelta(days=GRACE_DAYS)
    claim.deadline = deadline
    _persist(db, claim, "REQUEST_INFO", to_state, admin, comment)
    _notify(db, claim.applicant_id, "认领材料需补充",
            f"{comment.strip()}（请于 {deadline:%Y-%m-%d %H:%M} 前补充，逾期失效）")
    db.commit()
    return claim


def handover(db: Session, claim: Claim, admin: User, comment: str = "") -> Claim:
    _require_owner(claim, admin)
    to_state = sm.apply(claim.status, "HANDOVER", "admin", comment)
    claim.deadline = None
    _persist(db, claim, "HANDOVER", to_state, admin, comment)

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


def cancel(db: Session, claim: Claim, applicant: User, comment: str = "") -> Claim:
    if claim.applicant_id != applicant.id:
        raise sm.ForbiddenError("只能撤销自己提交的认领申请")
    to_state = sm.apply(claim.status, "CANCEL", "applicant", comment)
    _persist(db, claim, "CANCEL", to_state, applicant, comment)

    item = db.get(FoundItem, claim.found_item_id)
    if item and item.status in ("CLAIMING", "PICKUP_PENDING"):
        item.status = "REGISTERED"
    if claim.reviewer_id:
        _notify(db, claim.reviewer_id, "申请人撤销了认领",
                f"认领单#{claim.id} 已被申请人撤销，无需继续处理。")
    db.commit()
    return claim


def supplement(db: Session, claim: Claim, applicant: User, proof: str) -> Claim:
    if claim.applicant_id != applicant.id:
        raise sm.ForbiddenError("只能补充自己的认领材料")
    if not (proof or "").strip():
        raise sm.ValidationFailed("补充材料不能为空")
    to_state = sm.apply(claim.status, "RESUBMIT", "applicant")
    claim.proof = proof.strip()
    claim.deadline = None
    _persist(db, claim, "RESUBMIT", to_state, applicant, "申请人补充了凭证材料")
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
