from typing import List, Optional
from sqlmodel import Session, select
import uuid as uuid_pkg
from app.crud.base import CRUDBase
from app.models.field_value import FieldValues, FieldValuesCreate, FieldValuesUpdate


class CRUDFieldValues(CRUDBase[FieldValues, FieldValuesCreate, FieldValuesUpdate]):
    def get(self, db: Session, id: uuid_pkg.UUID) -> Optional[FieldValues]:
        """Get field values by UUID"""
        statement = select(FieldValues).where(FieldValues.id == id)
        return db.exec(statement).first()
    
    def get_by_device_id(self, db: Session, *, device_id: str, skip: int = 0, limit: int = 100) -> List[FieldValues]:
        """Get all field values for a specific device"""
        statement = (
            select(FieldValues)
            .where(FieldValues.device_id == device_id)
            .order_by(FieldValues.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_latest_by_device(self, db: Session, *, device_id: str) -> Optional[FieldValues]:
        """Get the latest field values for a device"""
        statement = (
            select(FieldValues)
            .where(FieldValues.device_id == device_id)
            .order_by(FieldValues.created_at.desc())
        )
        return db.exec(statement).first()
    
    def get_multi_with_filters(self, db: Session, *, skip: int = 0, limit: int = 100,
                              device_id: Optional[str] = None,
                              start_date: Optional[str] = None,
                              end_date: Optional[str] = None) -> List[FieldValues]:
        """Get field values with optional filters"""
        statement = select(FieldValues)
        
        conditions = []
        if device_id:
            conditions.append(FieldValues.device_id == device_id)
        if start_date:
            conditions.append(FieldValues.created_at >= start_date)
        if end_date:
            conditions.append(FieldValues.created_at <= end_date)
            
        if conditions:
            from sqlmodel import and_
            statement = statement.where(and_(*conditions))
        
        statement = statement.order_by(FieldValues.created_at.desc()).offset(skip).limit(limit)
        return db.exec(statement).all()


field_values = CRUDFieldValues(FieldValues)
