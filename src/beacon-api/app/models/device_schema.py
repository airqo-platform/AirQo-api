import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
from app.models.vendor import Vendor


class DeviceProfile(Base):
    """
    Defines a generic device archetype (e.g. 'AirQo-v5-DualPM', 'ColdChain-UltraLow', 'Solar-SmartInverter').
    Allows Beacon to operate on any IoT hardware family.
    """
    __tablename__ = "device_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)  # "air_quality", "cold_chain", "solar", etc.
    description = Column(String(500), nullable=True)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendor.id", ondelete="SET NULL"), nullable=True, index=True)
    meta_data = Column("metadata", JSONB, nullable=True)

    # Dynamic Field & Protocol Mappings stored in database
    telemetry_mappings = Column(JSONB, nullable=False, server_default='{}')   # field1–field20 -> semantic keys & labels
    config_mappings = Column(JSONB, nullable=False, server_default='{}')      # config1–config10 -> tunable params & types
    metadata_mappings = Column(JSONB, nullable=False, server_default='{}')    # metadata1–metadata15 -> static hardware traits

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    vendor = relationship("Vendor", back_populates="device_profiles")
    components = relationship("ComponentDefinition", back_populates="profile", cascade="all, delete-orphan")
    relationships = relationship("ComponentRelationship", back_populates="profile", cascade="all, delete-orphan")


class ComponentDefinition(Base):
    """
    Subsystem within a device profile (e.g., 'power_subsystem', 'battery', 'primary_sensor', 'modem').
    """
    __tablename__ = "component_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("device_profiles.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)           # e.g., "battery", "pm25_sensor_1", "solar_panel"
    component_type = Column(String(50), nullable=False) # e.g., "battery", "sensor", "solar", "connectivity", "cooling"
    criticality = Column(Float, default=1.0)            # Subsystem weight (0.0 to 1.0) in overall health score
    x_coordinate = Column(Float, nullable=True)         # Visual canvas X coordinate
    y_coordinate = Column(Float, nullable=True)         # Visual canvas Y coordinate
    meta_data = Column("metadata", JSONB, nullable=True)

    # Relationships
    profile = relationship("DeviceProfile", back_populates="components")
    metrics = relationship("MetricDefinition", back_populates="component", cascade="all, delete-orphan")


class MetricDefinition(Base):
    """
    Measurable parameter or telemetry field extracted from a component.
    Defines units, operating range boundaries, and plausible rate of change.
    """
    __tablename__ = "metric_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_definitions.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(100), nullable=False)            # e.g., "battery_voltage", "pm2_5", "temperature"
    unit = Column(String(30), nullable=True)             # e.g., "V", "ug/m3", "C", "A", "%"
    data_type = Column(String(30), default="float")      # "float", "integer", "boolean", "string"
    
    # Expected operating baseline envelope
    expected_min = Column(Float, nullable=True)
    expected_max = Column(Float, nullable=True)
    max_rate_of_change = Column(Float, nullable=True)    # Max rate of change per hour
    is_telemetry_field = Column(Boolean, default=True)

    # Relationships
    component = relationship("ComponentDefinition", back_populates="metrics")


class ComponentRelationship(Base):
    """
    Directed dependency graph between components (e.g., SolarPanel --[POWERS]--> Battery --[POWERS]--> Compute).
    Used by the diagnostic engine to trace cascading failures.
    """
    __tablename__ = "component_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("device_profiles.id", ondelete="CASCADE"), nullable=False)
    source_component_id = Column(UUID(as_uuid=True), ForeignKey("component_definitions.id", ondelete="CASCADE"), nullable=False)
    target_component_id = Column(UUID(as_uuid=True), ForeignKey("component_definitions.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(50), nullable=False) # "POWERS", "COMMUNICATES_VIA", "MEASURES_SAME_AS", "COOLS"

    # Relationships
    profile = relationship("DeviceProfile", back_populates="relationships")
    source_component = relationship("ComponentDefinition", foreign_keys=[source_component_id])
    target_component = relationship("ComponentDefinition", foreign_keys=[target_component_id])
