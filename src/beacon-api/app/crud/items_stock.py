from typing import List, Optional, Dict
from sqlmodel import Session, select, func, desc, and_
from uuid import UUID
from app.crud.base import CRUDBase
from app.models.items_stock import (
    ItemsStock, ItemsStockCreate, ItemsStockUpdate, ItemsStockHistory, 
    ChangeType, StockMovementSummary, ItemsStockRead
)


class CRUDItemsStock(CRUDBase[ItemsStock, ItemsStockCreate, ItemsStockUpdate]):
    def _get_stock_change(self, db: Session, item_id: UUID) -> Optional[int]:
        """
        Calculate stock change from most recent history record.
        Returns positive for stock in, negative for stock out, None if no history.
        """
        # Get the most recent history record for this item
        statement = (
            select(ItemsStockHistory)
            .where(ItemsStockHistory.item_id == item_id)
            .order_by(desc(ItemsStockHistory.changed_at))
            .limit(1)
        )
        most_recent = db.exec(statement).first()
        
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
            select(ItemsStockHistory)
            .where(
                and_(
                    ItemsStockHistory.item_id == item_id,
                    ItemsStockHistory.change_type.in_([ChangeType.INSERT, ChangeType.STOCK_IN])
                )
            )
            .order_by(desc(ItemsStockHistory.changed_at))
            .limit(1)
        )
        last_stock_in = db.exec(statement).first()
        
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
    
    def _enrich_items_with_change(self, db: Session, items: List[ItemsStock]) -> List[ItemsStockRead]:
        """
        Enrich items with change field and last stock-in details from history.
        """
        enriched_items = []
        for item in items:
            change = self._get_stock_change(db, item.id)
            stock_in_details = self._get_last_stock_in_details(db, item.id)
            
            item_dict = item.dict()
            item_dict['change'] = change
            item_dict['last_stocked_at'] = stock_in_details['last_stocked_at']
            item_dict['last_stock_addition'] = stock_in_details['last_stock_addition']
            item_dict['stock_after_last_addition'] = stock_in_details['stock_after_last_addition']
            
            enriched_items.append(ItemsStockRead(**item_dict))
        return enriched_items
    
    def get_by_id(self, db: Session, *, item_id: UUID) -> Optional[ItemsStockRead]:
        """Get an items stock record by ID with change field and stock-in details."""
        statement = select(self.model).where(self.model.id == item_id)
        item = db.exec(statement).first()
        
        if not item:
            return None
        
        change = self._get_stock_change(db, item_id)
        stock_in_details = self._get_last_stock_in_details(db, item_id)
        
        item_dict = item.dict()
        item_dict['change'] = change
        item_dict['last_stocked_at'] = stock_in_details['last_stocked_at']
        item_dict['last_stock_addition'] = stock_in_details['last_stock_addition']
        item_dict['stock_after_last_addition'] = stock_in_details['stock_after_last_addition']
        
        return ItemsStockRead(**item_dict)
    
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
        items = db.exec(statement).all()
        total = db.exec(count_statement).one()
        
        # Enrich items with change field
        enriched_items = self._enrich_items_with_change(db, items)
        
        return enriched_items, total
    
    def get_by_unit(self, db: Session, *, unit: str) -> List[ItemsStockRead]:
        """Get items stock by unit, enriched with change field."""
        statement = select(self.model).where(self.model.unit == unit)
        items = db.exec(statement).all()
        return self._enrich_items_with_change(db, items)
    
    def get_low_stock_items(self, db: Session, *, threshold: int = 10) -> List[ItemsStockRead]:
        """Get items with stock below threshold, enriched with change field."""
        statement = select(self.model).where(self.model.stock <= threshold)
        items = db.exec(statement).all()
        return self._enrich_items_with_change(db, items)
    
    def update_by_id(self, db: Session, *, item_id: UUID, obj_in: ItemsStockUpdate) -> Optional[ItemsStockRead]:
        """Update an items stock record by ID and return with change field."""
        # First get the raw database object
        statement = select(self.model).where(self.model.id == item_id)
        db_obj = db.exec(statement).first()
        
        if not db_obj:
            return None
        
        # Perform the update
        updated_obj = self.update(db=db, db_obj=db_obj, obj_in=obj_in)
        
        # Return enriched version with change field
        change = self._get_stock_change(db, item_id)
        item_dict = updated_obj.dict()
        item_dict['change'] = change
        return ItemsStockRead(**item_dict)


class CRUDItemsStockHistory(CRUDBase[ItemsStockHistory, None, None]):
    def get_item_history(
        self, 
        db: Session, 
        *, 
        item_id: UUID, 
        skip: int = 0, 
        limit: int = 100
    ) -> tuple[List[ItemsStockHistory], int]:
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
        
        history = db.exec(statement).all()
        total = db.exec(count_statement).one()
        
        return history, total
    
    def get_all_history_with_pagination(
        self, 
        db: Session, 
        *, 
        skip: int = 0, 
        limit: int = 100,
        change_type_filter: Optional[ChangeType] = None
    ) -> tuple[List[ItemsStockHistory], int]:
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
        history = db.exec(statement).all()
        total = db.exec(count_statement).one()
        
        return history, total
    
    # def get_stock_movements(
    #     self, 
    #     db: Session, 
    #     *, 
    #     item_id: Optional[UUID] = None
    # ) -> List[ItemsStockHistory]:
    #     """Get only stock movement records (STOCK_IN/STOCK_OUT)."""
    #     statement = select(self.model).where(
    #         self.model.change_type.in_([ChangeType.STOCK_IN, ChangeType.STOCK_OUT])
    #     )
        
    #     if item_id:
    #         statement = statement.where(self.model.item_id == item_id)
            
    #     statement = statement.order_by(desc(self.model.changed_at))
    #     return db.exec(statement).all()
    
    # def get_movement_summary(self, db: Session) -> List[StockMovementSummary]:
    #     """Get summary of stock movements."""
    #     # This would need raw SQL in a real implementation
    #     # For now, let's get the data and process it
    #     movements = self.get_stock_movements(db=db)
        
    #     summary = {}
    #     for movement in movements:
    #         change_type = movement.change_type
    #         if change_type not in summary:
    #             summary[change_type] = {
    #                 'transaction_count': 0,
    #                 'total_quantity_moved': 0
    #             }
            
    #         summary[change_type]['transaction_count'] += 1
            
    #         if change_type == ChangeType.STOCK_IN:
    #             quantity_moved = movement.new_stock - (movement.old_stock or 0)
    #         elif change_type == ChangeType.STOCK_OUT:
    #             quantity_moved = (movement.old_stock or 0) - movement.new_stock
    #         else:
    #             quantity_moved = 0
                
    #         summary[change_type]['total_quantity_moved'] += quantity_moved
        
    #     return [
    #         StockMovementSummary(
    #             change_type=change_type,
    #             transaction_count=data['transaction_count'],
    #             total_quantity_moved=data['total_quantity_moved']
    #         )
    #         for change_type, data in summary.items()
    #     ]


# Create instances
items_stock = CRUDItemsStock(ItemsStock)
items_stock_history = CRUDItemsStockHistory(ItemsStockHistory)