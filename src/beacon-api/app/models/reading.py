from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime


class DeviceReadingBase(SQLModel):
    device_key: int = Field(index=True)
    timestamp: datetime = Field(index=True)
    
    s1_pm2_5: Optional[float] = None
    s1_pm10: Optional[float] = None
    s2_pm2_5: Optional[float] = None
    s2_pm10: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    device_temperature: Optional[float] = None
    device_humidity: Optional[float] = None
    battery: Optional[float] = None
    altitude: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    hdop: Optional[float] = None
    satellites: Optional[int] = None
    frequency: Optional[str] = None


class DeviceReading(DeviceReadingBase, table=True):
    __tablename__ = "fact_device_readings"
    
    reading_key: Optional[int] = Field(default=None, primary_key=True)


class DeviceReadingCreate(DeviceReadingBase):
    pass


class DeviceReadingRead(DeviceReadingBase):
    reading_key: int