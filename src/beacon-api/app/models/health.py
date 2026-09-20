import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text, Boolean, DateTime, Date, Integer, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
from app.models.sync import SyncDevice


class DeviceHealthSnapshot(Base):
    """
    Periodic or on-demand health assessment snapshot for an IoT device.
    Tracks overall health score, lifecycle state, subsystem breakdown, and ranked diagnostic causes.
    """
    __tablename__ = "device_health_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    overall_health_score = Column(Float, nullable=False) # 0.0 to 100.0
    lifecycle_state = Column(String(30), nullable=False) # HEALTHY, DEGRADING, SUSPICIOUS, LIKELY_FAILURE, FAILED, RECOVERING
    
    subsystem_scores = Column(JSONB, nullable=False)     # {"power": 75.0, "sensors": 98.0, "connectivity": 100.0}
    active_evidences = Column(JSONB, nullable=True)      # List of triggered evidence facts with confidence
    detected_symptoms = Column(JSONB, nullable=True)     # List of active symptoms
    top_diagnoses = Column(JSONB, nullable=True)         # Ranked root causes with confidence % and recommendations
    evaluated_window_hours = Column(Float, default=24.0) # Evaluation time horizon
    metadata_context = Column(JSONB, nullable=True)      # Weather, diurnal context, operational mode


class DiagnosticFeedback(Base):
    """
    Ground truth captured from field technicians during maintenance or repair.
    Used for continuous model learning and evidential weight calibration.
    """
    __tablename__ = "diagnostic_feedback"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("device_health_snapshots.id", ondelete="SET NULL"), nullable=True)
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="CASCADE"), nullable=False, index=True)
    technician_user_id = Column(String(255), nullable=False)
    confirmed_cause_code = Column(String(100), nullable=False)
    was_prediction_accurate = Column(Boolean, nullable=False)
    actions_taken = Column(Text, nullable=True)
    technician_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class DeviceDailyDiagnostic(Base):
    """
    One diagnostic evaluation per device per completed UTC day, computed from the
    raw readings stored by the ThingSpeak sync. Re-running a day replaces its row.
    """
    __tablename__ = "device_daily_diagnostics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(String(50), nullable=True)
    diagnosis_date = Column(Date, nullable=False, index=True)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("device_profiles.id", ondelete="SET NULL"), nullable=True)

    record_count = Column(Integer, nullable=False, server_default="0")
    hours_with_data = Column(Integer, nullable=False, server_default="0")  # 0–24 UTC hours with at least one reading
    first_record_at = Column(DateTime(timezone=True), nullable=True)
    last_record_at = Column(DateTime(timezone=True), nullable=True)

    overall_health_score = Column(Float, nullable=False)
    lifecycle_state = Column(String(30), nullable=False)
    subsystem_scores = Column(JSONB, nullable=False)
    active_evidences = Column(JSONB, nullable=True)
    detected_symptoms = Column(JSONB, nullable=True)
    top_diagnoses = Column(JSONB, nullable=True)
    top_cause_code = Column(String(255), nullable=True, index=True)

    issue_count = Column(Integer, nullable=False, server_default="0")
    max_severity = Column(String(20), nullable=True)
    resolved_issue_codes = Column(JSONB, nullable=True)  # Issues present on the previous diagnosed day but not this one
    metrics_summary = Column(JSONB, nullable=True)       # {"battery_voltage": {"mean": .., "min": .., "max": .., "count": ..}}
    indicators = Column(JSONB, nullable=True)            # {component: {"charge_cycle" | "coverage" | "agreement:<other>": {...}}}
    trends = Column(JSONB, nullable=True)                # Multi-day trends of the indicators as of this day
    headline = Column(String(300), nullable=True)        # "Likely failure (47/100): device_battery (battery) fault (92%)"
    summary = Column(Text, nullable=True)                # Plain-language description of the day

    engine_version = Column(String(20), nullable=True)
    evaluated_at = Column(DateTime(timezone=True), server_default=func.now())

    issues = relationship(
        "DeviceDailyIssue",
        back_populates="daily_diagnostic",
        cascade="all, delete-orphan",
        order_by="DeviceDailyIssue.issue_code",
    )

    __table_args__ = (
        UniqueConstraint("device_id", "diagnosis_date", name="uq_daily_diag_device_date"),
        Index("ix_daily_diag_date_state", "diagnosis_date", "lifecycle_state"),
    )


class DeviceDailyIssue(Base):
    """
    A single issue detected for a device on a given day, with streak tracking so
    persistent faults can be distinguished from one-off anomalies.
    """
    __tablename__ = "device_daily_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    daily_diagnostic_id = Column(
        UUID(as_uuid=True), ForeignKey("device_daily_diagnostics.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id = Column(String(100), nullable=False, index=True)
    diagnosis_date = Column(Date, nullable=False)

    issue_code = Column(String(255), nullable=False)  # e.g. "METRIC_BELOW_MIN:device_battery.battery_voltage"
    check_type = Column(String(50), nullable=False)   # e.g. "METRIC_BELOW_MIN", "DATA_GAPS"
    component_name = Column(String(100), nullable=True)
    metric_key = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False)
    subsystem = Column(String(50), nullable=False)    # Component type from the profile, e.g. "battery"
    severity = Column(String(20), nullable=False)     # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    value = Column(JSONB, nullable=True)

    is_new = Column(Boolean, nullable=False, server_default="true")
    streak_days = Column(Integer, nullable=False, server_default="1")
    streak_start_date = Column(Date, nullable=False)

    daily_diagnostic = relationship("DeviceDailyDiagnostic", back_populates="issues")

    __table_args__ = (
        UniqueConstraint("device_id", "diagnosis_date", "issue_code", name="uq_daily_issue_device_date_code"),
        Index("ix_daily_issue_code_date", "issue_code", "diagnosis_date"),
        Index("ix_daily_issue_date_severity", "diagnosis_date", "severity"),
    )
