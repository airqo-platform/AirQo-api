from typing import List, Optional
from sqlmodel import Session, select
import uuid as uuid_pkg
from app.crud.base import CRUDBase
from app.models.metadata_value import MetadataValues, MetadataValuesCreate, MetadataValuesUpdate


class CRUDMetadataValues(CRUDBase[MetadataValues, MetadataValuesCreate, MetadataValuesUpdate]):
    def get(self, db: Session, id: uuid_pkg.UUID) -> Optional[MetadataValues]:
        """Get metadata values by UUID"""
        statement = select(MetadataValues).where(MetadataValues.id == id)
        return db.exec(statement).first()
    
    def get_by_device_id(self, db: Session, *, device_id: str, skip: int = 0, limit: int = 100) -> List[MetadataValues]:
        """Get all metadata values for a specific device"""
        statement = (
            select(MetadataValues)
            .where(MetadataValues.device_id == device_id)
            .order_by(MetadataValues.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_latest_by_device(self, db: Session, *, device_id: str) -> Optional[MetadataValues]:
        """Get the latest metadata values for a device"""
        statement = (
            select(MetadataValues)
            .where(MetadataValues.device_id == device_id)
            .order_by(MetadataValues.created_at.desc())
        )
        return db.exec(statement).first()
    
    def get_multi_with_filters(self, db: Session, *, skip: int = 0, limit: int = 100, 
                              device_id: Optional[str] = None,
                              start_date: Optional[str] = None,
                              end_date: Optional[str] = None) -> List[MetadataValues]:
        """Get metadata values with optional filters"""
        statement = select(MetadataValues)
        
        conditions = []
        if device_id:
            conditions.append(MetadataValues.device_id == device_id)
        if start_date:
            conditions.append(MetadataValues.created_at >= start_date)
        if end_date:
            conditions.append(MetadataValues.created_at <= end_date)
            
        if conditions:
            from sqlmodel import and_
            statement = statement.where(and_(*conditions))
        
        statement = statement.order_by(MetadataValues.created_at.desc()).offset(skip).limit(limit)
        return db.exec(statement).all()


metadata_values = CRUDMetadataValues(MetadataValues)
