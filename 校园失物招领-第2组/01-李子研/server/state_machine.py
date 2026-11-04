"""认领单审核状态机 —— 唯一合法迁移裁决点（纯逻辑，不碰数据库）。

迁移表与 api-contract-v0.md §4 完全一致，改这里等于改契约，需全组同步。
"""

# ---------- 状态 ----------
STATES = {
    "SUBMITTED": "待审核",
    "UNDER_REVIEW": "审核中",
    "PENDING_INFO": "待补充材料",
    "APPROVED": "审核通过·待领取",
    "REJECTED": "已驳回",
    "CANCELLED": "已撤销",
    "COMPLETED": "已完成",
    "EXPIRED": "已失效",
}
TERMINAL = {"REJECTED", "CANCELLED", "COMPLETED", "EXPIRED"}

# ---------- 事件 ----------
EVENTS = {
    "ACCEPT": "审核员接单",
    "APPROVE": "审核通过",
    "REJECT": "驳回",
    "REQUEST_INFO": "退回补充材料",
    "RESUBMIT": "申请人补充材料",
    "HANDOVER": "确认交接",
    "CANCEL": "撤销申请",
    "EXPIRE": "超时失效（系统）",
}

# (from_state, event) -> (to_state, actors, need_comment)
# actors: admin=审核员, applicant=申请人, system=系统定时任务
TRANSITIONS = {
    ("SUBMITTED", "ACCEPT"):       ("UNDER_REVIEW", {"admin"}, False),
    ("SUBMITTED", "REJECT"):       ("REJECTED",     {"admin"}, True),
    ("SUBMITTED", "CANCEL"):       ("CANCELLED",    {"applicant"}, False),

    ("UNDER_REVIEW", "APPROVE"):   ("APPROVED",     {"admin"}, False),
    ("UNDER_REVIEW", "REJECT"):    ("REJECTED",     {"admin"}, True),
    ("UNDER_REVIEW", "REQUEST_INFO"): ("PENDING_INFO", {"admin"}, True),
    ("UNDER_REVIEW", "CANCEL"):    ("CANCELLED",    {"applicant"}, False),

    ("PENDING_INFO", "RESUBMIT"):  ("UNDER_REVIEW", {"applicant"}, False),
    ("PENDING_INFO", "CANCEL"):    ("CANCELLED",    {"applicant"}, False),
    ("PENDING_INFO", "EXPIRE"):    ("EXPIRED",      {"system"}, False),

    ("APPROVED", "HANDOVER"):      ("COMPLETED",    {"admin"}, False),
    ("APPROVED", "EXPIRE"):        ("EXPIRED",      {"system"}, False),
}


# ---------- 异常 ----------
class DomainError(Exception):
    code = 40000
    message = "DOMAIN_ERROR"

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class IllegalTransition(DomainError):
    code = 40001
    message = "ILLEGAL_TRANSITION"


class ForbiddenError(DomainError):
    code = 40002
    message = "FORBIDDEN"


class ValidationFailed(DomainError):
    code = 40003
    message = "VALIDATION_ERROR"


class NotFound(DomainError):
    code = 40401
    message = "NOT_FOUND"


# ---------- 对外接口 ----------
def is_terminal(state: str) -> bool:
    return state in TERMINAL


def can(state: str, event: str) -> bool:
    return (state, event) in TRANSITIONS


def allowed_events(state: str) -> list:
    """当前状态下可执行的事件（供前端按钮置灰/文档核对用）。"""
    return [e for (s, e) in TRANSITIONS if s == state]


def check(state: str, event: str, actor_role: str, comment: str = "") -> str:
    """校验并返回目标状态；不合法直接抛领域异常。"""
    if event not in EVENTS:
        raise ValidationFailed(f"未知事件 {event}")
    if is_terminal(state):
        raise IllegalTransition(f"{state}({STATES[state]}) 为终态，不允许事件 {event}")
    edge = TRANSITIONS.get((state, event))
    if edge is None:
        raise IllegalTransition(
            f"{state}({STATES[state]}) 不允许事件 {event}；可执行事件：{allowed_events(state) or '无'}"
        )
    to_state, actors, need_comment = edge
    if actor_role not in actors:
        raise ForbiddenError(f"角色 {actor_role} 无权对 {state} 执行 {event}（允许：{sorted(actors)}）")
    if need_comment and not (comment or "").strip():
        raise ValidationFailed(f"{EVENTS[event]}必须填写原因/意见")
    return to_state


def apply(state: str, event: str, actor_role: str, comment: str = "") -> str:
    """迁移：返回目标状态。调用方负责落库（写 review_record + 伴随动作）。"""
    return check(state, event, actor_role, comment)
