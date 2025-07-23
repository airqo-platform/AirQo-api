# app/models.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    role = Column(String, default="user")  # user, admin, superadmin
    status = Column(String, default="active")  # active, inactive, suspended
    phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True)
    name = Column(String)
    long_name = Column(String)
    alias = Column(String)
    serial_number = Column(String)
    device_number = Column(Integer)
    network = Column(String)
    category = Column(String)
    status = Column(String)
    is_active = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)
    is_primary_in_location = Column(Boolean, default=False)
    mobility = Column(Boolean, default=False)
    visibility = Column(Boolean, default=True)
    height = Column(Float)
    mount_type = Column(String)
    power_type = Column(String)
    auth_required = Column(Boolean, default=False)
    latitude = Column(Float)
    longitude = Column(Float)
    site_id = Column(String)
    site_name = Column(String)
    location_name = Column(String)
    search_name = Column(String)
    deployment_date = Column(DateTime)
    next_maintenance = Column(DateTime)
    last_active = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DeviceReading(Base):
    __tablename__ = "device_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    pm2_5 = Column(Float)
    pm10 = Column(Float)
    no2 = Column(Float)
    temperature = Column(Float)
    humidity = Column(Float)
    aqi_category = Column(String)
    aqi_color = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, nullable=False)
    maintenance_type = Column(String)  # scheduled, emergency, repair
    description = Column(Text)
    technician_name = Column(String)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    status = Column(String, default="pending")  # pending, in_progress, completed, cancelled
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)