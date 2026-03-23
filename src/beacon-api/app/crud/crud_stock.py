from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func, and_
from app.crud.base import CRUDBase
from app.models.sync import SyncItemsStock, SyncItemsStockHistory
from app.schemas.stock import (
    ItemsStockCreate, 
    ItemsStockUpdate, 
    ItemsStockRead, 
    ChangeType
)

class CRUDItemsStock(CRUDBase[SyncItemsStock, ItemsStockCreate, ItemsStockUpdate]):
    def _get_stock_change(self, db: Session, item_id: UUID) -> Optional[int]:
        """
        Calculate stock change from most recent history record.
        Returns positive for stock in, negative for stock out, None if no history.
        """
        # Get the most recent history record for this item
        statement = (
            select(SyncItemsStockHistory)
            .where(SyncItemsStockHistory.item_id == item_id)
            .order_by(desc(SyncItemsStockHistory.changed_at))
            .limit(1)
        )
        most_recent = db.execute(statement).scalars().first()
        
        if not most_recent:
            return None
        
        # Calculate change based on the most recent history
        if most_recent.old_stock is None:
            # INSERT record - change is the initial stock
            return most_recent.new_stock
        else:
            # UPDATE/other records - change is difference
            return most_recent.new_stock - most_recent.old_stock
    
    def _get_last_stock_in_details(self, db: Session, item_id: UUID) -> Dict:
        """
        Get details of the last stock-in operation (INSERT or STOCK_IN).
        Returns dict with: last_stocked_at, last_stock_addition, stock_after_last_addition
        """
        # Get the most recent INSERT or STOCK_IN record
        statement = (
            select(SyncItemsStockHistory)
            .where(
                and_(
                    SyncItemsStockHistory.item_id == item_id,
                    SyncItemsStockHistory.change_type.in_([ChangeType.INSERT, ChangeType.STOCK_IN])
                )
            )
            .order_by(desc(SyncItemsStockHistory.changed_at))
            .limit(1)
        )
        last_stock_in = db.execute(statement).scalars().first()
        
        if not last_stock_in:
            return {
                'last_stocked_at': None,
                'last_stock_addition': None,
                'stock_after_last_addition': None
            }
        
        # Calculate the addition amount
        if last_stock_in.change_type == ChangeType.INSERT:
            addition = last_stock_in.new_stock
        else:  # STOCK_IN
            addition = last_stock_in.new_stock - (last_stock_in.old_stock or 0)
        
        return {
            'last_stocked_at': last_stock_in.changed_at,
            'last_stock_addition': addition,
            'stock_after_last_addition': last_stock_in.new_stock
        }
    
    def _enrich_items_with_change(self, db: Session, items: List[SyncItemsStock]) -> List[ItemsStockRead]:
        """
        Enrich items with change field and last stock-in details from history.
        """
        enriched_items = []
        for item in items:
            change = self._get_stock_change(db, item.id)
            stock_in_details = self._get_last_stock_in_details(db, item.id)
            
            # Using __dict__ and removing internal SQLAlchemy state if needed, 
            # but model_dump is safer for SQLModel/Pydantic
            # Here it's a SQLAlchemy model, so we can convert it manually or use a helper
            
            item_data = {
                "id": item.id,
                "name": item.name,
                "stock": item.stock,
                "unit": item.unit,
                "created_date": item.created_date,
                "updated_at": item.updated_at,
                "change": change,
                "last_stocked_at": stock_in_details['last_stocked_at'],
                "last_stock_addition": stock_in_details['last_stock_addition'],
                "stock_after_last_addition": stock_in_details['stock_after_last_addition']
            }
            
            enriched_items.append(ItemsStockRead(**item_data))
        return enriched_items

    def create(self, db: Session, *, obj_in: ItemsStockCreate) -> ItemsStockRead:
        """Create a new items stock entry and its history."""
        import datetime
        db_obj = SyncItemsStock(
            name=obj_in.name,
            stock=obj_in.stock,
            unit=obj_in.unit,
            created_date=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Create history record
        history_obj = SyncItemsStockHistory(
            item_id=db_obj.id,
            old_stock=None,
            new_stock=db_obj.stock,
            old_unit=None,
            new_unit=db_obj.unit,
            change_type=ChangeType.INSERT,
            changed_at=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(history_obj)
        db.commit()
        
        return self.get_by_id(db, item_id=db_obj.id)

    def get_by_id(self, db: Session, *, item_id: UUID) -> Optional[ItemsStockRead]:
        """Get an items stock record by ID with change field and stock-in details."""
        statement = select(self.model).where(self.model.id == item_id)
        item = db.execute(statement).scalars().first()
        
        if not item:
            return None
        
        change = self._get_stock_change(db, item_id)
        stock_in_details = self._get_last_stock_in_details(db, item_id)
        
        item_data = {
            "id": item.id,
            "name": item.name,
            "stock": item.stock,
            "unit": item.unit,
            "created_date": item.created_date,
            "updated_at": item.updated_at,
            "change": change,
            "last_stocked_at": stock_in_details['last_stocked_at'],
            "last_stock_addition": stock_in_details['last_stock_addition'],
            "stock_after_last_addition": stock_in_details['stock_after_last_addition']
        }
        
        return ItemsStockRead(**item_data)
    
    def get_all_with_pagination(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        name_filter: Optional[str] = None,
        unit_filter: Optional[str] = None,
        min_stock: Optional[int] = None,
        max_stock: Optional[int] = None
    ) -> tuple[List[ItemsStockRead], int]:
        """Get all items stock with pagination and optional filtering, enriched with change field."""
        # Build base query
        statement = select(self.model)
        count_statement = select(func.count(self.model.id))
        
        # Apply filters
        conditions = []
        if name_filter:
            conditions.append(self.model.name.ilike(f"%{name_filter}%"))
        if unit_filter:
            conditions.append(self.model.unit.ilike(f"%{unit_filter}%"))
        if min_stock is not None:
            conditions.append(self.model.stock >= min_stock)
        if max_stock is not None:
            conditions.append(self.model.stock <= max_stock)
        
        if conditions:
            statement = statement.where(and_(*conditions))
            count_statement = count_statement.where(and_(*conditions))
        
        # Apply pagination and ordering
        statement = statement.order_by(desc(self.model.created_date)).offset(skip).limit(limit)
        
        # Execute queries
        items = db.execute(statement).scalars().all()
        total = db.execute(count_statement).scalar() or 0
        
        # Enrich items with change field
        enriched_items = self._enrich_items_with_change(db, items)
        
        return enriched_items, total
    
    def get_by_unit(self, db: Session, *, unit: str) -> List[ItemsStockRead]:
        """Get items stock by unit, enriched with change field."""
        statement = select(self.model).where(self.model.unit == unit)
        items = db.execute(statement).scalars().all()
        return self._enrich_items_with_change(db, items)
    
    def get_low_stock_items(self, db: Session, *, threshold: int = 10) -> List[ItemsStockRead]:
        """Get items with stock below threshold, enriched with change field."""
        statement = select(self.model).where(self.model.stock <= threshold)
        items = db.execute(statement).scalars().all()
        return self._enrich_items_with_change(db, items)
    
    def update_by_id(self, db: Session, *, item_id: UUID, obj_in: ItemsStockUpdate) -> Optional[ItemsStockRead]:
        """Update an items stock record by ID and return with change field."""
        # First get the raw database object
        statement = select(self.model).where(self.model.id == item_id)
        db_obj = db.execute(statement).scalars().first()
        
        if not db_obj:
            return None
        
        old_stock = db_obj.stock
        old_unit = db_obj.unit
        
        # Perform the update
        update_data = obj_in.model_dump(exclude_unset=True)
        for field in update_data:
            setattr(db_obj, field, update_data[field])
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Determine change type and create history record
        change_type = None
        if obj_in.stock is not None:
            if obj_in.stock > old_stock:
                change_type = ChangeType.STOCK_IN
            elif obj_in.stock < old_stock:
                change_type = ChangeType.STOCK_OUT
            elif obj_in.unit is not None and obj_in.unit != old_unit:
                change_type = ChangeType.UNIT_CHANGE
        elif obj_in.unit is not None and obj_in.unit != old_unit:
            change_type = ChangeType.UNIT_CHANGE
            
        if change_type:
            import datetime
            history_obj = SyncItemsStockHistory(
                item_id=item_id,
                old_stock=old_stock,
                new_stock=db_obj.stock,
                old_unit=old_unit,
                new_unit=db_obj.unit,
                change_type=change_type,
                changed_at=datetime.datetime.now(datetime.timezone.utc)
            )
            db.add(history_obj)
            db.commit()
        
        return self.get_by_id(db, item_id=item_id)


class CRUDItemsStockHistory(CRUDBase[SyncItemsStockHistory, Any, Any]):
    def get_item_history(
        self, 
        db: Session, 
        *, 
        item_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> tuple[List[SyncItemsStockHistory], int]:
        """Get history for a specific item with pagination."""
        statement = (
            select(self.model)
            .where(self.model.item_id == item_id)
            .order_by(desc(self.model.changed_at))
            .offset(skip)
            .limit(limit)
        )
        
        count_statement = (
            select(func.count(self.model.history_id))
            .where(self.model.item_id == item_id)
        )
        
        history = db.execute(statement).scalars().all()
        total = db.execute(count_statement).scalar() or 0
        
        return history, total
    
    def get_all_history_with_pagination(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        change_type_filter: Optional[ChangeType] = None
    ) -> tuple[List[SyncItemsStockHistory], int]:
        """Get all history with pagination and optional filtering."""
        statement = select(self.model)
        count_statement = select(func.count(self.model.history_id))
        
        # Apply filter
        if change_type_filter:
            statement = statement.where(self.model.change_type == change_type_filter)
            count_statement = count_statement.where(self.model.change_type == change_type_filter)
        
        # Apply pagination and ordering
        statement = statement.order_by(desc(self.model.changed_at)).offset(skip).limit(limit)
        
        # Execute queries
        history = db.execute(statement).scalars().all()
        total = db.execute(count_statement).scalar() or 0
        
        return history, total

items_stock = CRUDItemsStock(SyncItemsStock)
items_stock_history = CRUDItemsStockHistory(SyncItemsStockHistory)
