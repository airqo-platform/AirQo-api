from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

class ChangeType(str, Enum):
    INSERT = "INSERT"
    STOCK_IN = "STOCK_IN"
    STOCK_OUT = "STOCK_OUT"
    UNIT_CHANGE = "UNIT_CHANGE"
    DELETE = "DELETE"

class ItemsStockBase(BaseModel):
    name: str = Field(..., max_length=255, description="Name of the stock item")
    stock: int = Field(default=0, ge=0, description="Stock quantity (must be >= 0)")
    unit: str = Field(..., max_length=255, description="Unit of measurement")

class ItemsStockCreate(ItemsStockBase):
    pass

class ItemsStockUpdate(BaseModel):
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
    
    model_config = ConfigDict(from_attributes=True)

class ItemsStockHistoryBase(BaseModel):
    item_id: UUID = Field(..., description="ID of the stock item")
    old_stock: Optional[int] = Field(default=None, description="Previous stock quantity")
    new_stock: int = Field(..., description="New stock quantity")
    old_unit: Optional[str] = Field(default=None, description="Previous unit")
    new_unit: str = Field(..., description="New unit")
    change_type: ChangeType = Field(..., description="Type of change")

class ItemsStockHistoryRead(ItemsStockHistoryBase):
    history_id: UUID
    changed_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

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

class StockMovementSummary(BaseModel):
    change_type: ChangeType
    transaction_count: int
    total_quantity_moved: int

class ItemsStockResponse(BaseModel):
    items: List[ItemsStockRead]
    total: int
    page: int
    page_size: int
    has_next: bool

class ItemsStockHistoryResponse(BaseModel):
    history: List[ItemsStockHistoryRead]
    total: int
    page: int
    page_size: int
    has_next: bool
