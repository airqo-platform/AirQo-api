from typing import List, Optional, Tuple, Union, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorUpdate


class CRUDVendor(CRUDBase[Vendor, VendorCreate, VendorUpdate]):
    def get_by_name(self, db: Session, *, name: str) -> Optional[Vendor]:
        return db.query(self.model).filter(self.model.name.ilike(name.strip())).first()

    def get_multi_paginated(
        self, db: Session, *, skip: int = 0, limit: int = 100, name_filter: Optional[str] = None
    ) -> Tuple[List[Vendor], int]:
        query = db.query(self.model)
        if name_filter:
            query = query.filter(self.model.name.ilike(f"%{name_filter.strip()}%"))
        total = query.count()
        items = query.order_by(self.model.name.asc()).offset(skip).limit(limit).all()
        return items, total


vendor = CRUDVendor(Vendor)
