import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
