import json
from sqlalchemy import Column, String, Float, Date, DateTime, Text, Boolean, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.session import Base


class SyncDevicePerformance(Base):
    __tablename__ = "sync_device_performance"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    device_id = Column(String(100), nullable=False)
    device_name = Column(String(200), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    last_active = Column(String(100), nullable=True)
    uptime = Column(Float, nullable=False, default=0.0)
    data_completeness = Column(Float, nullable=False, default=0.0)
    error_margin = Column(Float, nullable=False, default=0.0)
    cohorts_json = Column(Text, nullable=True)  # JSON-serialized list of cohort names
    complete_performance = Column(Boolean, nullable=False, server_default="false")  # True = full day computed
    computed_for_date = Column(Date, nullable=False)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("device_name", "computed_for_date", name="uq_device_name_date"),
        Index("ix_computed_for_date", "computed_for_date"),
    )

    @property
    def cohorts(self):
        if self.cohorts_json:
            try:
                return json.loads(self.cohorts_json)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @cohorts.setter
    def cohorts(self, value):
        self.cohorts_json = json.dumps(value) if value else "[]"

    def to_map_view_dict(self):
        """Return a dict matching the MapViewDeviceEntry schema."""
        return {
            "device_id": self.device_id,
            "device_name": self.device_name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "last_active": self.last_active,
            "uptime": self.uptime or 0.0,
            "data_completeness": self.data_completeness or 0.0,
            "error_margin": self.error_margin or 0.0,
            "cohorts": self.cohorts,
        }
