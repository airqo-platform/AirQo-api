# app/schemas.py
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: str = "user"
    status: str = "active"
    phone: Optional[str] = None
    location: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        orm_mode = True

class DeviceBase(BaseModel):
    device_id: str
    name: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = True
    is_online: Optional[bool] = False

class DeviceCreate(DeviceBase):
    pass

class Device(DeviceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class DeviceReadingBase(BaseModel):
    device_id: str
    timestamp: datetime
    pm2_5: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None

class DeviceReadingCreate(DeviceReadingBase):
    pass

class DeviceReading(DeviceReadingBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

class MaintenanceRecordBase(BaseModel):
    device_id: str
    maintenance_type: str
    description: Optional[str] = None
    technician_name: Optional[str] = None
    start_time: datetime

class MaintenanceRecordCreate(MaintenanceRecordBase):
    pass

class MaintenanceRecord(MaintenanceRecordBase):
    id: int
    end_time: Optional[datetime] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None