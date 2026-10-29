import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func
from app.db.session import Base


from app.models.firmware import Firmware
from sqlmodel import SQLModel

for table_name, table in SQLModel.metadata.tables.items():
    if table_name not in Base.metadata.tables:
        table.to_metadata(Base.metadata)


class Vendor(Base):
    """
    Hardware or equipment vendor/manufacturer (e.g., 'AirQo', 'Met One Instruments', 'Generic ColdChain').
    Allows Beacon to categorize and manage hardware device profiles and firmware assets by vendor.
    """
    __tablename__ = "vendor"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    device_profiles = relationship("DeviceProfile", back_populates="vendor")
    firmwares = relationship(Firmware, primaryjoin=lambda: Vendor.id == foreign(Firmware.vendor_id), backref="vendor")
