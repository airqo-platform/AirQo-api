from typing import List, Optional
from sqlmodel import Session, select, func
from app.crud.base import CRUDBase
from app.models.site import Site, SiteCreate, SiteUpdate
from app.models.device import Device


class CRUDSite(CRUDBase[Site, SiteCreate, SiteUpdate]):
    def get(self, db: Session, id: str) -> Optional[Site]:
        """Get site by site_id"""
        statement = select(Site).where(Site.site_id == id)
        return db.exec(statement).first()
    
    def get_by_key(self, db: Session, *, site_key: int) -> Optional[Site]:
        """Get site by site_key (primary key)"""
        statement = select(Site).where(Site.site_key == site_key)
        return db.exec(statement).first()
    
    def get_by_name(self, db: Session, *, site_name: str) -> Optional[Site]:
        statement = select(Site).where(Site.site_name == site_name)
        return db.exec(statement).first()
    
    def get_by_city(self, db: Session, *, city: str, skip: int = 0, limit: int = 100) -> List[Site]:
        statement = select(Site).where(Site.city == city).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_by_district(self, db: Session, *, district: str, skip: int = 0, limit: int = 100) -> List[Site]:
        statement = select(Site).where(Site.district == district).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_by_category(self, db: Session, *, site_category: str, skip: int = 0, limit: int = 100) -> List[Site]:
        statement = select(Site).where(Site.site_category == site_category).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_with_device_count(self, db: Session, *, site_id: str) -> Optional[dict]:
        site = self.get(db, id=site_id)
        if site:
            # Count devices associated with this site through dim_device.site_id
            device_count = db.exec(
                select(func.count(Device.device_key))
                .where(Device.site_id == site_id)
            ).first()
            site_dict = site.dict()
            site_dict["device_count"] = device_count or 0
            return site_dict
        return None
    
    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Site]:
        """Get multiple sites"""
        statement = select(Site).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def remove(self, db: Session, *, id: str) -> Site:
        """Delete site by site_id"""
        obj = self.get(db, id=id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj


site = CRUDSite(Site)