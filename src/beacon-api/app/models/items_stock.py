from sqlmodel import Field, SQLModel
from typing import Optional, List
from datetime import datetime, timezone
from uuid import UUID, uuid4
from enum import Enum


class ChangeType(str, Enum):
    INSERT = "INSERT"
    STOCK_IN = "STOCK_IN"
    STOCK_OUT = "STOCK_OUT"
    UNIT_CHANGE = "UNIT_CHANGE"
    DELETE = "DELETE"


class ItemsStockBase(SQLModel):
    name: str = Field(max_length=255, description="Name of the stock item")
    stock: int = Field(default=0, ge=0, description="Stock quantity (must be >= 0)")
    unit: str = Field(max_length=255, description="Unit of measurement")


class ItemsStock(ItemsStockBase, table=True):
    __tablename__ = "items_stock"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ItemsStockCreate(ItemsStockBase):
    pass


class ItemsStockUpdate(SQLModel):
    name: Optional[str] = Field(default=None, max_length=255, description="Name of the stock item")
    stock: Optional[int] = Field(default=None, ge=0, description="Stock quantity (must be >= 0)")
    unit: Optional[str] = Field(default=None, max_length=255, description="Unit of measurement")


class ItemsStockRead(ItemsStockBase):
    id: UUID
    created_date: datetime
    updated_at: datetime
    change: Optional[int] = Field(default=None, description="Stock change from most recent history (positive = stock in, negative = stock out)")
    last_stocked_at: Optional[datetime] = Field(default=None, description="Last time item was stocked (INSERT or STOCK_IN)")
    last_stock_addition: Optional[int] = Field(default=None, description="Amount added in last stock-in operation")
    stock_after_last_addition: Optional[int] = Field(default=None, description="Total stock after last addition")


class ItemsStockHistoryBase(SQLModel):
    item_id: UUID = Field(foreign_key="items_stock.id")
    old_stock: Optional[int] = Field(default=None, description="Previous stock quantity")
    new_stock: int = Field(description="New stock quantity")
    old_unit: Optional[str] = Field(default=None, description="Previous unit")
    new_unit: str = Field(description="New unit")
    change_type: ChangeType = Field(description="Type of change")


class ItemsStockHistory(ItemsStockHistoryBase, table=True):
    __tablename__ = "items_stock_history"
    
    history_id: UUID = Field(default_factory=uuid4, primary_key=True)
    changed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ItemsStockHistoryRead(ItemsStockHistoryBase):
    history_id: UUID
    changed_at: datetime
    
    # Computed fields for better readability
    @property
    def change_description(self) -> str:
        if self.change_type == ChangeType.STOCK_IN:
            quantity_change = self.new_stock - (self.old_stock or 0)
            return f"Stock increased by {quantity_change}"
        elif self.change_type == ChangeType.STOCK_OUT:
            quantity_change = (self.old_stock or 0) - self.new_stock
            return f"Stock decreased by {quantity_change}"
        elif self.change_type == ChangeType.UNIT_CHANGE:
            return f"Unit changed from {self.old_unit or 'N/A'} to {self.new_unit}"
        elif self.change_type == ChangeType.INSERT:
            return "New item created"
        elif self.change_type == ChangeType.DELETE:
            return "Item deleted"
        else:
            return self.change_type


class ItemsStockWithHistory(ItemsStockRead):
    history: List[ItemsStockHistoryRead] = []


class StockMovementSummary(SQLModel):
    change_type: ChangeType
    transaction_count: int
    total_quantity_moved: int


class ItemsStockResponse(SQLModel):
    items: List[ItemsStockRead]
    total: int
    page: int
    page_size: int
    has_next: bool


class ItemsStockHistoryResponse(SQLModel):
    history: List[ItemsStockHistoryRead]
    total: int
    page: int
    page_size: int
    has_next: bool