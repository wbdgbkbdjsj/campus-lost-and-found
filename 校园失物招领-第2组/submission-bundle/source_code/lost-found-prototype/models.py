"""ORM 模型 —— 与 api-contract-v1.md §2 数据字典一一对应（9 张表）。

v1：新增 category / location 字典表；user.role 改 student/reviewer/super_admin；
    user 增加 status 字段；audit_log 转正。
"""
from datetime import datetime
from hashlib import sha256

from sqlalchemy import (Boolean, Column, DateTime, ForeignKey, Integer, String,
                        create_engine, event)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DB_URL = "sqlite:///./lostfound.db"
engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()


@event.listens_for(engine, "connect")
def _fk_on(dbapi_conn, _):
    """SQLite 默认不校验外键，这里打开（契约要求外键约束生效）。"""
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def now() -> datetime:
    return datetime.now().replace(microsecond=0)


def hash_pwd(raw: str) -> str:
    return sha256(raw.encode("utf-8")).hexdigest()


class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True)
    student_no = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(50), nullable=False)
    role = Column(String(20), default="student", nullable=False)  # student|reviewer|super_admin
    phone = Column(String(20), default="")
    status = Column(String(10), default="ACTIVE", nullable=False)  # ACTIVE|DISABLED
    password_hash = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=now)


class Category(Base):
    __tablename__ = "category"
    id = Column(Integer, primary_key=True)
    name = Column(String(20), unique=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class Location(Base):
    __tablename__ = "location"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class LostItem(Base):
    __tablename__ = "lost_item"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    category_id = Column(Integer, ForeignKey("category.id"), nullable=False)
    lost_location = Column(String(100), default="")
    lost_time = Column(DateTime)
    status = Column(String(20), default="OPEN", nullable=False)  # OPEN|MATCHED|CLOSED
    created_at = Column(DateTime, default=now)


class FoundItem(Base):
    __tablename__ = "found_item"
    id = Column(Integer, primary_key=True)
    finder_id = Column(Integer, ForeignKey("user.id"), index=True)
    title = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    category_id = Column(Integer, ForeignKey("category.id"), nullable=False)
    found_location = Column(String(100), default="")
    found_time = Column(DateTime)
    image_url = Column(String(255), default="")
    storage_location = Column(String(100), default="")
    # REGISTERED -> CLAIMING -> PICKUP_PENDING -> CLAIMED ; 旁路 CLOSED
    status = Column(String(20), default="REGISTERED", nullable=False)
    created_at = Column(DateTime, default=now)


class Claim(Base):
    __tablename__ = "claim"
    id = Column(Integer, primary_key=True)
    found_item_id = Column(Integer, ForeignKey("found_item.id"), nullable=False, index=True)
    applicant_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("user.id"), index=True)
    description = Column(String(500), default="")
    proof = Column(String(500), nullable=False)
    contact = Column(String(50), default="")
    status = Column(String(20), default="SUBMITTED", nullable=False, index=True)
    deadline = Column(DateTime)
    submitted_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now)
    records = relationship("ReviewRecord", back_populates="claim",
                           cascade="all, delete-orphan", order_by="ReviewRecord.id")


class ReviewRecord(Base):
    __tablename__ = "review_record"
    id = Column(Integer, primary_key=True)
    claim_id = Column(Integer, ForeignKey("claim.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("user.id"))
    action = Column(String(20), nullable=False)
    from_status = Column(String(20))
    to_status = Column(String(20), nullable=False)
    comment = Column(String(500), default="")
    created_at = Column(DateTime, default=now)
    claim = relationship("Claim", back_populates="records")


class Notification(Base):
    __tablename__ = "notification"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    content = Column(String(300), default="")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer, nullable=False)
    entity = Column(String(30), nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String(30), nullable=False)
    detail = Column(String(300), default="")
    created_at = Column(DateTime, default=now)


def init_db():
    Base.metadata.create_all(engine)
