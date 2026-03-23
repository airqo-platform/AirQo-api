from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.sync import Category
from app.schemas.category import CategoryCreate, CategoryUpdate

class CRUDCategory(CRUDBase[Category, CategoryCreate, CategoryUpdate]):
    def get_by_name(self, db: Session, *, name: str) -> Optional[Category]:
        return db.query(self.model).filter(self.model.name == name).first()

    def get_multi_paginated(
        self, db: Session, *, skip: int = 0, limit: int = 100, name_filter: Optional[str] = None
    ) -> (List[Category], int):
        query = db.query(self.model)
        if name_filter:
            query = query.filter(self.model.name.ilike(f"%{name_filter}%"))
        
        total = query.count()
        items = query.offset(skip).limit(limit).all()
        return items, total

category = CRUDCategory(Category)
