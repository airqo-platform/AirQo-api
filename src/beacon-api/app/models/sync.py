from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, UUID, Text, CheckConstraint
from sqlalchemy.sql import func
import sqlalchemy as sa
from app.db.session import Base
import uuid

# SyncFirmware is now managed in app/models/firmware.py

class Category(Base):
    __tablename__ = "category"

    name = Column(String(100), primary_key=True, nullable=False)
    level = Column(String(100))
    description = Column(String(100))
    field1 = Column(String(100))
    field2 = Column(String(100))
    field3 = Column(String(100))
    field4 = Column(String(100))
    field5 = Column(String(100))
    field6 = Column(String(100))
    field7 = Column(String(100))
    field8 = Column(String(100))
    field9 = Column(String(100))
    field10 = Column(String(100))
    field11 = Column(String(100))
    field12 = Column(String(100))
    field13 = Column(String(100))
    field14 = Column(String(100))
    field15 = Column(String(100))
    metadata1 = Column(String(100))
    metadata2 = Column(String(100))
    metadata3 = Column(String(100))
    metadata4 = Column(String(100))
    metadata5 = Column(String(100))
    metadata6 = Column(String(100))
    metadata7 = Column(String(100))
    metadata8 = Column(String(100))
    metadata9 = Column(String(100))
    metadata10 = Column(String(100))
    metadata11 = Column(String(100))
    metadata12 = Column(String(100))
    metadata13 = Column(String(100))
    metadata14 = Column(String(100))
    metadata15 = Column(String(100))
    config1 = Column(String(100))
    config2 = Column(String(100))
    config3 = Column(String(100))
    config4 = Column(String(100))
    config5 = Column(String(100))
    config6 = Column(String(100))
    config7 = Column(String(100))
    config8 = Column(String(100))
    config9 = Column(String(100))
    config10 = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SyncDevice(Base):
    __tablename__ = "sync_device"

    device_id = Column(String(100), primary_key=True, nullable=False)
    network_id = Column(String(100))
    current_firmware = Column(String(100))
    previous_firmware = Column(String(100))
    target_firmware = Column(String(100))
    file_upload_state = Column(Boolean, server_default="false")
    firmware_download_state = Column(String(100))

class SyncConfigValues(Base):
    __tablename__ = "sync_config_values"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    config1 = Column(String(100))
    config2 = Column(String(100))
    config3 = Column(String(100))
    config4 = Column(String(100))
    config5 = Column(String(100))
    config6 = Column(String(100))
    config7 = Column(String(100))
    config8 = Column(String(100))
    config9 = Column(String(100))
    config10 = Column(String(100))
    config_updated = Column(Boolean, server_default="false")

class SyncMetadataValues(Base):
    __tablename__ = "sync_metadata_values"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    device_id = Column(String(100), ForeignKey("sync_device.device_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    metadata1 = Column(String(100))
    metadata2 = Column(String(100))
    metadata3 = Column(String(100))
    metadata4 = Column(String(100))
    metadata5 = Column(String(100))
    metadata6 = Column(String(100))
    metadata7 = Column(String(100))
    metadata8 = Column(String(100))
    metadata9 = Column(String(100))
    metadata10 = Column(String(100))
    metadata11 = Column(String(100))
    metadata12 = Column(String(100))
    metadata13 = Column(String(100))
    metadata14 = Column(String(100))
    metadata15 = Column(String(100))

    field15 = Column(String(100))

class SyncItemsStock(Base):
    __tablename__ = "sync_items_stock"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(Text, nullable=False)
    stock = Column(Integer, server_default="0", nullable=False)
    unit = Column(Text, nullable=False)
    created_date = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("stock >= 0", name="chk_items_stock_stock"),
        CheckConstraint("name IS NOT NULL AND trim(name) != ''", name="chk_items_stock_name_not_empty"),
        CheckConstraint("unit IS NOT NULL AND trim(unit) != ''", name="chk_items_stock_unit_not_empty"),
    )

class SyncItemsStockHistory(Base):
    __tablename__ = "sync_items_stock_history"

    history_id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    item_id = Column(UUID(as_uuid=True), ForeignKey("sync_items_stock.id", ondelete="CASCADE"), nullable=False)
    old_stock = Column(Integer)
    new_stock = Column(Integer, nullable=False)
    old_unit = Column(Text)
    new_unit = Column(Text, nullable=False)
    change_type = Column(String(20), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "change_type IN ('INSERT', 'STOCK_IN', 'STOCK_OUT', 'UNIT_CHANGE', 'DELETE')",
            name="chk_items_stock_history_change_type"
        ),
        CheckConstraint(
            "(old_stock IS NULL OR old_stock >= 0) AND (new_stock >= 0)",
            name="chk_items_stock_history_stock_values"
        ),
        CheckConstraint(
            "(old_unit IS NULL OR trim(old_unit) != '') AND (new_unit IS NOT NULL AND trim(new_unit) != '')",
            name="chk_items_stock_history_unit_not_empty"
        ),
    )
