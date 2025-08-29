from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime


class DeviceReadingBase(SQLModel):
    device_key: int = Field(index=True)
    device_id: Optional[str] = None
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    frequency: Optional[str] = None
    network: Optional[str] = None
    site_name: Optional[str] = None
    created_at: Optional[datetime] = None


class DeviceReading(DeviceReadingBase, table=True):
    __tablename__ = "fact_device_readings"
    
    reading_key: Optional[int] = Field(default=None, primary_key=True)


class DeviceReadingCreate(DeviceReadingBase):
    pass


class DeviceReadingRead(DeviceReadingBase):
    reading_key: int