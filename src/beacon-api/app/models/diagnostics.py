import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
from app.models.device_schema import DeviceProfile


class DiagnosticTemplate(Base):
    """
    Reusable diagnostic template defining symptoms, causes, and evidential weighting rules
    for a specific hardware subsystem (e.g., 'LiFePO4 Battery System', 'Dual Optical PM Sensors', 'Compressor Refrigerator').
    """
    __tablename__ = "diagnostic_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), unique=True, nullable=False, index=True)
    target_component_type = Column(String(50), nullable=False, index=True) # e.g. "battery", "sensor", "cooling", "connectivity"
    description = Column(Text, nullable=True)
    version = Column(String(20), default="1.0.0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    symptoms = relationship("SymptomDefinition", back_populates="template", cascade="all, delete-orphan")
    causes = relationship("CauseDefinition", back_populates="template", cascade="all, delete-orphan")
    profile_links = relationship("ProfileDiagnosticTemplate", back_populates="template", cascade="all, delete-orphan")


class SymptomDefinition(Base):
    """
    Observable symptom indicating an operational anomaly (e.g. 'Overnight Power Collapse', 'Sensor Drift/Divergence').
    """
    __tablename__ = "symptom_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("diagnostic_templates.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(100), nullable=False, index=True)  # e.g. "SYM_RAPID_DISCHARGE"
    name = Column(String(200), nullable=False)
    severity = Column(String(20), default="MEDIUM")        # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    evaluation_logic = Column(JSONB, nullable=True)        # Conditions/rules to trigger symptom
    description = Column(Text, nullable=True)

    # Relationships
    template = relationship("DiagnosticTemplate", back_populates="symptoms")


class CauseDefinition(Base):
    """
    Root failure mode / cause hypothesis (e.g. 'Battery Cell Capacity Loss', 'Air Inlet Blockage').
    Contains prescriptive remediation recommendations.
    """
    __tablename__ = "cause_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("diagnostic_templates.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(100), nullable=False, index=True)  # e.g. "CAUSE_BATTERY_DEGRADATION"
    title = Column(String(200), nullable=False)
    category = Column(String(50), default="HARDWARE_FAILURE") # "HARDWARE_FAILURE", "ENVIRONMENTAL", "CONFIG_ERROR", "WEAR_AND_TEAR"
    description = Column(Text, nullable=True)
    recommended_action = Column(Text, nullable=False)       # Specific instruction for field technicians

    # Relationships
    template = relationship("DiagnosticTemplate", back_populates="causes")
    hypothesis_rules = relationship("DiagnosticHypothesisRule", back_populates="cause", cascade="all, delete-orphan")


class DiagnosticHypothesisRule(Base):
    """
    Evidential Rule mapping an evidence fact to a root cause with a support (+) or refute (-) weight.
    Used by the Bayesian / Log-Odds reasoner.
    """
    __tablename__ = "diagnostic_hypothesis_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cause_id = Column(UUID(as_uuid=True), ForeignKey("cause_definitions.id", ondelete="CASCADE"), nullable=False)
    evidence_code = Column(String(100), nullable=False, index=True) # e.g. "EVID_BATTERY_RAPID_NIGHT_DISCHARGE"
    weight = Column(Float, nullable=False)                         # Positive = supports (+2.5), Negative = refutes (-3.0)
    is_mandatory = Column(Boolean, default=False)                  # If true, cause cannot be confirmed without this evidence
    description = Column(String(300), nullable=True)

    # Relationships
    cause = relationship("CauseDefinition", back_populates="hypothesis_rules")


class ProfileDiagnosticTemplate(Base):
    """
    Junction linking a DeviceProfile to active DiagnosticTemplates.
    """
    __tablename__ = "profile_diagnostic_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("device_profiles.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("diagnostic_templates.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    profile = relationship(DeviceProfile, backref="profile_templates")
    template = relationship(DiagnosticTemplate, back_populates="profile_links")
