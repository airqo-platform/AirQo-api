from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.session import Base


class SyncRawDeviceData(Base):
    """
    Stores every individual ThingSpeak feed entry (raw readings).
    field1–field7 come directly from ThingSpeak.
    field8–field20 are parsed from the field8 CSV metadata string.

    Retention: 2 weeks.
    """
    __tablename__ = "sync_raw_device_data"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    channel_id = Column(String(50), nullable=False, index=True)
    device_id = Column(String(100), nullable=True)   # logical link to sync_device.device_id
    entry_id = Column(Integer, nullable=False)
    created_at_ts = Column(DateTime(timezone=True), nullable=False)  # ThingSpeak created_at

    # Direct ThingSpeak fields
    field1 = Column(Float, nullable=True)
    field2 = Column(Float, nullable=True)
    field3 = Column(Float, nullable=True)
    field4 = Column(Float, nullable=True)
    field5 = Column(Float, nullable=True)
    field6 = Column(Float, nullable=True)
    field7 = Column(Float, nullable=True)

    # Parsed from field8 CSV (positions 0–12 → field8–field20)
    field8 = Column(Float, nullable=True)
    field9 = Column(Float, nullable=True)
    field10 = Column(Float, nullable=True)
    field11 = Column(Float, nullable=True)
    field12 = Column(Float, nullable=True)
    field13 = Column(Float, nullable=True)
    field14 = Column(Float, nullable=True)
    field15 = Column(Float, nullable=True)
    field16 = Column(Float, nullable=True)
    field17 = Column(Float, nullable=True)
    field18 = Column(Float, nullable=True)
    field19 = Column(Float, nullable=True)
    field20 = Column(Float, nullable=True)

    synced_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("channel_id", "entry_id", name="uq_raw_channel_entry"),
        Index("ix_raw_channel_created", "channel_id", "created_at_ts"),
    )


class SyncHourlyDeviceData(Base):
    """
    Hourly aggregation of raw ThingSpeak data.
    Each row is the mean of all raw readings in a 1-hour bucket.

    complete = True means the full hour had elapsed when we computed.
    Retention: 1 month.
    """
    __tablename__ = "sync_hourly_device_data"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    channel_id = Column(String(50), nullable=False, index=True)
    device_id = Column(String(100), nullable=True)
    hour_start = Column(DateTime(timezone=True), nullable=False)  # truncated to hour

    # Averaged fields
    field1_avg = Column(Float, nullable=True)
    field2_avg = Column(Float, nullable=True)
    field3_avg = Column(Float, nullable=True)
    field4_avg = Column(Float, nullable=True)
    field5_avg = Column(Float, nullable=True)
    field6_avg = Column(Float, nullable=True)
    field7_avg = Column(Float, nullable=True)
    field8_avg = Column(Float, nullable=True)
    field9_avg = Column(Float, nullable=True)
    field10_avg = Column(Float, nullable=True)
    field11_avg = Column(Float, nullable=True)
    field12_avg = Column(Float, nullable=True)
    field13_avg = Column(Float, nullable=True)
    field14_avg = Column(Float, nullable=True)
    field15_avg = Column(Float, nullable=True)
    field16_avg = Column(Float, nullable=True)
    field17_avg = Column(Float, nullable=True)
    field18_avg = Column(Float, nullable=True)
    field19_avg = Column(Float, nullable=True)
    field20_avg = Column(Float, nullable=True)

    record_count = Column(Integer, nullable=False, server_default="0")
    complete = Column(Boolean, nullable=False, server_default="false")
    synced_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("channel_id", "hour_start", name="uq_hourly_channel_hour"),
        Index("ix_hourly_channel_hour", "channel_id", "hour_start"),
    )


class SyncDailyDeviceData(Base):
    """
    Daily aggregation of raw ThingSpeak data.
    Each row is the mean of all raw readings for a full calendar day.

    complete = True means the full day had elapsed when we computed.
    Retention: 6 months.
    """
    __tablename__ = "sync_daily_device_data"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    channel_id = Column(String(50), nullable=False, index=True)
    device_id = Column(String(100), nullable=True)
    data_date = Column(Date, nullable=False)  # the calendar date

    # Averaged fields
    field1_avg = Column(Float, nullable=True)
    field2_avg = Column(Float, nullable=True)
    field3_avg = Column(Float, nullable=True)
    field4_avg = Column(Float, nullable=True)
    field5_avg = Column(Float, nullable=True)
    field6_avg = Column(Float, nullable=True)
    field7_avg = Column(Float, nullable=True)
    field8_avg = Column(Float, nullable=True)
    field9_avg = Column(Float, nullable=True)
    field10_avg = Column(Float, nullable=True)
    field11_avg = Column(Float, nullable=True)
    field12_avg = Column(Float, nullable=True)
    field13_avg = Column(Float, nullable=True)
    field14_avg = Column(Float, nullable=True)
    field15_avg = Column(Float, nullable=True)
    field16_avg = Column(Float, nullable=True)
    field17_avg = Column(Float, nullable=True)
    field18_avg = Column(Float, nullable=True)
    field19_avg = Column(Float, nullable=True)
    field20_avg = Column(Float, nullable=True)

    record_count = Column(Integer, nullable=False, server_default="0")
    complete = Column(Boolean, nullable=False, server_default="false")
    synced_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("channel_id", "data_date", name="uq_daily_channel_date"),
        Index("ix_daily_channel_date", "channel_id", "data_date"),
    )
