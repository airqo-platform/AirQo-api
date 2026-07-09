import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base

class WebRTCSession(Base):
    __tablename__ = "webrtc_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    host_id = Column(String(255), nullable=False)  # User ID of host (from JWT)
    controller_id = Column(String(255), nullable=True)  # User ID of active controller
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, CLOSED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    members = relationship("WebRTCSessionMember", back_populates="session", cascade="all, delete-orphan")
    invitations = relationship("WebRTCSessionInvitation", back_populates="session", cascade="all, delete-orphan")
    audit_logs = relationship("WebRTCAuditLog", back_populates="session", cascade="all, delete-orphan")


class WebRTCSessionMember(Base):
    __tablename__ = "webrtc_session_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("webrtc_sessions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(255), nullable=False)
    role = Column(String(50), default="Viewer", nullable=False)  # Host, Viewer, Participant
    can_control = Column(Boolean, default=False, nullable=False)  # Controller Permission
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    left_at = Column(DateTime(timezone=True), nullable=True)
    connected = Column(Boolean, default=False, nullable=False)
    connected_at = Column(DateTime(timezone=True), nullable=True)
    disconnected_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    session = relationship("WebRTCSession", back_populates="members")

    __table_args__ = (
        Index("idx_webrtc_member_session_user", "session_id", "user_id"),
    )


class WebRTCSessionInvitation(Base):
    __tablename__ = "webrtc_session_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("webrtc_sessions.id", ondelete="CASCADE"), nullable=False)
    inviter_id = Column(String(255), nullable=False)
    invitee_id = Column(String(255), nullable=False)  # Target user ID
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, ACCEPTED, REJECTED, CANCELLED

    # Relationships
    session = relationship("WebRTCSession", back_populates="invitations")


class WebRTCAuditLog(Base):
    __tablename__ = "webrtc_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("webrtc_sessions.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    details = Column(JSONB, nullable=True)

    # Relationships
    session = relationship("WebRTCSession", back_populates="audit_logs")
