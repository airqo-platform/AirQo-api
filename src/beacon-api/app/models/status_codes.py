import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class StatusCodeSet(Base):
    """
    Meanings of the status codes a device type reports in a telemetry field, and the rule for
    reading a reported value: "bitmask" (the value is a sum of single-bit codes, e.g. BAM-1020
    status 17 = 16 Flow Failure + 1 Tape Break) or "exact" (the value is one code).
    Profiles point a telemetry field at a set by name via `"status_code_set"` in its mapping.
    """
    __tablename__ = "status_code_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)   # e.g. "bam-1020"
    description = Column(Text, nullable=True)
    decode_rule = Column(String(20), nullable=False, server_default="bitmask")  # "bitmask" | "exact"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    codes = relationship(
        "StatusCode",
        back_populates="code_set",
        cascade="all, delete-orphan",
        order_by="StatusCode.code",
    )


class StatusCode(Base):
    """One status code and what it means."""
    __tablename__ = "status_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code_set_id = Column(UUID(as_uuid=True), ForeignKey("status_code_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(Integer, nullable=False)
    label = Column(String(150), nullable=False)          # e.g. "Flow Failure"
    description = Column(Text, nullable=True)            # likely cause, shown to technicians
    kind = Column(String(20), nullable=False, server_default="fault")  # "ok" | "fault" | "info"

    code_set = relationship("StatusCodeSet", back_populates="codes")

    __table_args__ = (
        UniqueConstraint("code_set_id", "code", name="uq_status_code_set_code"),
    )
