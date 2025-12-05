from typing import List, Optional
from sqlmodel import Session, select
import uuid as uuid_pkg
from app.crud.base import CRUDBase
from app.models.device_file import DeviceFiles, DeviceFilesCreate, DeviceFilesUpdate


class CRUDDeviceFiles(CRUDBase[DeviceFiles, DeviceFilesCreate, DeviceFilesUpdate]):
    def get(self, db: Session, id: uuid_pkg.UUID) -> Optional[DeviceFiles]:
        """Get device file by UUID"""
        statement = select(DeviceFiles).where(DeviceFiles.id == id)
        return db.exec(statement).first()
    
    def get_by_device_id(self, db: Session, *, device_id: str, skip: int = 0, limit: int = 100) -> List[DeviceFiles]:
        """Get all files for a specific device"""
        statement = (
            select(DeviceFiles)
            .where(DeviceFiles.device_id == device_id)
            .order_by(DeviceFiles.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_by_filename(self, db: Session, *, filename: str, skip: int = 0, limit: int = 100) -> List[DeviceFiles]:
        """Get all records for a specific filename"""
        statement = (
            select(DeviceFiles)
            .where(DeviceFiles.file == filename)
            .order_by(DeviceFiles.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_latest_by_device(self, db: Session, *, device_id: str) -> Optional[DeviceFiles]:
        """Get the most recently uploaded file for a device"""
        statement = (
            select(DeviceFiles)
            .where(DeviceFiles.device_id == device_id)
            .order_by(DeviceFiles.created_at.desc())
        )
        return db.exec(statement).first()
    
    def search_files(self, db: Session, *, search_term: str, skip: int = 0, limit: int = 100) -> List[DeviceFiles]:
        """Search files by partial filename match"""
        statement = (
            select(DeviceFiles)
            .where(DeviceFiles.file.contains(search_term))
            .order_by(DeviceFiles.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()


device_files = CRUDDeviceFiles(DeviceFiles)
