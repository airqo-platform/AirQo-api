from typing import List, Optional
from sqlmodel import Session, select, func
from app.crud.base import CRUDBase
from app.models.site import Site, SiteCreate, SiteUpdate
from app.models.device import Device


class CRUDSite(CRUDBase[Site, SiteCreate, SiteUpdate]):
    def get_by_name(self, db: Session, *, site_name: str) -> Optional[Site]:
        statement = select(Site).where(Site.site_name == site_name)
        return db.exec(statement).first()
    
    def get_by_region(self, db: Session, *, region: str, skip: int = 0, limit: int = 100) -> List[Site]:
        statement = select(Site).where(Site.region == region).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_by_district(self, db: Session, *, district: str, skip: int = 0, limit: int = 100) -> List[Site]:
        statement = select(Site).where(Site.district == district).offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Site]:
        statement = select(Site).where(Site.status == "active").offset(skip).limit(limit)
        return db.exec(statement).all()
    
    def get_with_device_count(self, db: Session, *, site_id: str) -> Optional[dict]:
        site = self.get(db, id=site_id)
        if site:
            device_count = db.exec(
                select(func.count(Device.id)).where(Device.site_id == site_id)
            ).first()
            site_dict = site.dict()
            site_dict["device_count"] = device_count or 0
            return site_dict
        return None


site = CRUDSite(Site)