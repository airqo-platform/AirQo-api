from typing import List, Optional
from sqlmodel import Session, select
from datetime import datetime, timedelta
from app.crud.base import CRUDBase
from app.models.device import Device, DeviceCreate, DeviceUpdate


class CRUDDevice(CRUDBase[Device, DeviceCreate, DeviceUpdate]):
    def get_by_device_id(self, db: Session, *, device_id: str) -> Optional[Device]:
        statement = select(Device).where(Device.device_id == device_id)
        return db.exec(statement).first()
    
    def get_by_name(self, db: Session, *, device_name: str) -> Optional[Device]:
        statement = select(Device).where(Device.device_name == device_name)
        return db.exec(statement).first()
    
    def get_by_site(self, db: Session, *, site_id: str, skip: int = 0, limit: int = 100) -> List[Device]:
        statement = select(Device).where(Device.site_id == site_id).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Device]:
        statement = select(Device).where(Device.status == "active").offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_by_network(self, db: Session, *, network: str, skip: int = 0, limit: int = 100) -> List[Device]:
        statement = select(Device).where(Device.network == network).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_offline_devices(self, db: Session, *, hours: int = 24) -> List[Device]:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        statement = select(Device).where(
            (Device.is_online == False) | 
            (Device.last_updated < cutoff_time) | 
            (Device.last_updated == None)
        )
        return db.exec(statement).all()
    
    def update_last_seen(self, db: Session, *, device_key: int) -> Device:
        device = self.get(db, id=device_key)
        if device:
            device.last_updated = datetime.utcnow()
            db.add(device)
            db.commit()
            db.refresh(device)
        return device


device = CRUDDevice(Device)