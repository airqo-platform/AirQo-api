from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Raw Data ──────────────────────────────────────────────────────────────────

class RawDeviceDataRecord(BaseModel):
    channel_id: str
    device_id: Optional[str] = None
    entry_id: int
    created_at_ts: datetime
    field1: Optional[float] = None
    field2: Optional[float] = None
    field3: Optional[float] = None
    field4: Optional[float] = None
    field5: Optional[float] = None
    field6: Optional[float] = None
    field7: Optional[float] = None
    field8: Optional[float] = None
    field9: Optional[float] = None
    field10: Optional[float] = None
    field11: Optional[float] = None
    field12: Optional[float] = None
    field13: Optional[float] = None
    field14: Optional[float] = None
    field15: Optional[float] = None
    field16: Optional[float] = None
    field17: Optional[float] = None
    field18: Optional[float] = None
    field19: Optional[float] = None
    field20: Optional[float] = None
    synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Hourly Data ───────────────────────────────────────────────────────────────

class HourlyDeviceDataRecord(BaseModel):
    channel_id: str
    device_id: Optional[str] = None
    hour_start: datetime
    field1_avg: Optional[float] = None
    field2_avg: Optional[float] = None
    field3_avg: Optional[float] = None
    field4_avg: Optional[float] = None
    field5_avg: Optional[float] = None
    field6_avg: Optional[float] = None
    field7_avg: Optional[float] = None
    field8_avg: Optional[float] = None
    field9_avg: Optional[float] = None
    field10_avg: Optional[float] = None
    field11_avg: Optional[float] = None
    field12_avg: Optional[float] = None
    field13_avg: Optional[float] = None
    field14_avg: Optional[float] = None
    field15_avg: Optional[float] = None
    field16_avg: Optional[float] = None
    field17_avg: Optional[float] = None
    field18_avg: Optional[float] = None
    field19_avg: Optional[float] = None
    field20_avg: Optional[float] = None
    record_count: int = 0
    complete: bool = False
    synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Daily Data ────────────────────────────────────────────────────────────────

class DailyDeviceDataRecord(BaseModel):
    channel_id: str
    device_id: Optional[str] = None
    data_date: date
    field1_avg: Optional[float] = None
    field2_avg: Optional[float] = None
    field3_avg: Optional[float] = None
    field4_avg: Optional[float] = None
    field5_avg: Optional[float] = None
    field6_avg: Optional[float] = None
    field7_avg: Optional[float] = None
    field8_avg: Optional[float] = None
    field9_avg: Optional[float] = None
    field10_avg: Optional[float] = None
    field11_avg: Optional[float] = None
    field12_avg: Optional[float] = None
    field13_avg: Optional[float] = None
    field14_avg: Optional[float] = None
    field15_avg: Optional[float] = None
    field16_avg: Optional[float] = None
    field17_avg: Optional[float] = None
    field18_avg: Optional[float] = None
    field19_avg: Optional[float] = None
    field20_avg: Optional[float] = None
    record_count: int = 0
    complete: bool = False
    synced_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Response Wrappers ─────────────────────────────────────────────────────────

class SyncTriggerResponse(BaseModel):
    success: bool
    message: str


class SyncResultResponse(BaseModel):
    success: bool
    message: str
    devices: int = 0
    raw_records: int = 0
    hourly_records: int = 0
    daily_records: int = 0
    date_range: Optional[str] = None


class RawDataResponse(BaseModel):
    data: List[RawDeviceDataRecord]
    count: int


class HourlyDataResponse(BaseModel):
    data: List[HourlyDeviceDataRecord]
    count: int


class DailyDataResponse(BaseModel):
    data: List[DailyDeviceDataRecord]
    count: int
