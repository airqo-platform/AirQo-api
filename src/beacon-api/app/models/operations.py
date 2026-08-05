import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.session import Base

# Import existing models first
from app.models.sync import SyncDevice
from app.models.firmware import Firmware

# Dynamically merge SQLModel.metadata tables into Base.metadata
# BEFORE mapping our operations classes so that mappers resolve foreign keys correctly.
from sqlmodel import SQLModel
for table_name, table in SQLModel.metadata.tables.items():
    if table_name not in Base.metadata.tables:
        table.to_metadata(Base.metadata)

# New Tables

class DeviceSession(Base):
    __tablename__ = "device_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=True)  # User ID of session creator (from JWT)
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="SET NULL"), nullable=True)
    session_type = Column(String(50), nullable=False)  # LOCAL, REMOTE, SHARED, PROVISIONING, FLASHING, DEBUGGING
    controller_user_id = Column(String(255), nullable=True)  # The single active controller user ID
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, CLOSED, FAILED, ABANDONED
    meta_data = Column("metadata", JSONB, nullable=True)

    # Relationships
    device = relationship(SyncDevice, backref="sessions")
    jobs = relationship("DeviceJob", back_populates="session", cascade="all, delete-orphan")
    logs = relationship("SessionLog", back_populates="session", cascade="all, delete-orphan")


class DeviceJob(Base):
    __tablename__ = "device_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("device_sessions.id", ondelete="CASCADE"), nullable=False)
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="SET NULL"), nullable=True)
    firmware_id = Column(UUID(as_uuid=True), ForeignKey("sync_firmware.id", ondelete="SET NULL"), nullable=True)
    job_type = Column(String(50), nullable=False)  # FLASH_FIRMWARE, CONFIGURE_DEVICE, RESTART_DEVICE, FACTORY_RESET, etc.
    status = Column(String(50), default="QUEUED", nullable=False)  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    progress = Column(Integer, default=0, nullable=False)  # 0 to 100
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    requested_by = Column(String(255), nullable=False)
    meta_data = Column("metadata", JSONB, nullable=True)
    result = Column(JSONB, nullable=True)

    # Relationships
    session = relationship("DeviceSession", back_populates="jobs")
    device = relationship(SyncDevice, backref="jobs")
    firmware = relationship(Firmware, primaryjoin=lambda: DeviceJob.firmware_id == Firmware.id, foreign_keys=[firmware_id])


class SessionLog(Base):
    __tablename__ = "session_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("device_sessions.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(1000), nullable=False)
    log_type = Column(String(50), nullable=False)  # SERIAL_LOG, FLASH_LOG, AGENT_LOG, DEBUG_LOG
    size = Column(Integer, nullable=False)  # size in bytes
    checksum = Column(String(255), nullable=False)  # checksum hash
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    session = relationship("DeviceSession", back_populates="logs")


class Command(Base):
    __tablename__ = "commands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, index=True, nullable=False)  # reboot, factory_reset, etc.
    description = Column(String(500), nullable=True)
    command_template = Column(String(1000), nullable=False)
    parameter_schema = Column(JSONB, nullable=True)  # JSON Schema for validation
    supported_boards = Column(JSONB, nullable=True)  # List of string board types supported
    dangerous = Column(Boolean, default=False, nullable=False)
    requires_confirmation = Column(Boolean, default=False, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
