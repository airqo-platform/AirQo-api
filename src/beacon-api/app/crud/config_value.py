from typing import List, Optional
from sqlmodel import Session, select
import uuid as uuid_pkg
from app.crud.base import CRUDBase
from app.models.config_value import ConfigValues, ConfigValuesCreate, ConfigValuesUpdate


class CRUDConfigValues(CRUDBase[ConfigValues, ConfigValuesCreate, ConfigValuesUpdate]):
    def get(self, db: Session, id: uuid_pkg.UUID) -> Optional[ConfigValues]:
        """Get config values by UUID"""
        statement = select(ConfigValues).where(ConfigValues.id == id)
        return db.exec(statement).first()
    
    def get_by_device_id(self, db: Session, *, device_id: str, skip: int = 0, limit: int = 100) -> List[ConfigValues]:
        """Get all config values for a specific device"""
        statement = (
            select(ConfigValues)
            .where(ConfigValues.device_id == device_id)
            .order_by(ConfigValues.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_latest_by_device(self, db: Session, *, device_id: str) -> Optional[ConfigValues]:
        """Get the latest config values for a device"""
        statement = (
            select(ConfigValues)
            .where(ConfigValues.device_id == device_id)
            .order_by(ConfigValues.created_at.desc())
        )
        return db.exec(statement).first()
    
    def get_pending_updates(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[ConfigValues]:
        """Get config values where config_updated is False"""
        statement = (
            select(ConfigValues)
            .where(ConfigValues.config_updated == False)
            .order_by(ConfigValues.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.exec(statement).all()
    
    def get_multi_with_filters(self, db: Session, *, skip: int = 0, limit: int = 100,
                              device_id: Optional[str] = None,
                              start_date: Optional[str] = None,
                              end_date: Optional[str] = None) -> List[ConfigValues]:
        """Get config values with optional filters"""
        statement = select(ConfigValues)
        
        conditions = []
        if device_id:
            conditions.append(ConfigValues.device_id == device_id)
        if start_date:
            conditions.append(ConfigValues.created_at >= start_date)
        if end_date:
            conditions.append(ConfigValues.created_at <= end_date)
            
        if conditions:
            from sqlmodel import and_
            statement = statement.where(and_(*conditions))
        
        statement = statement.order_by(ConfigValues.created_at.desc()).offset(skip).limit(limit)
        return db.exec(statement).all()


config_values = CRUDConfigValues(ConfigValues)
