from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.crud.crud_stock import items_stock as items_stock_crud, items_stock_history as history_crud
from app.schemas.stock import (
    ItemsStockRead,
    ItemsStockCreate,
    ItemsStockUpdate,
    ItemsStockResponse,
    ItemsStockWithHistory,
    ItemsStockHistoryRead
)

router = APIRouter()

@router.post("", response_model=ItemsStockRead, status_code=201)
def create_item_stock(
    *,
    db: Session = Depends(get_db),
    item_in: ItemsStockCreate
):
    """
    Create a new items stock entry.
    
    - **name**: Name of the stock item (required)
    - **stock**: Initial stock quantity (must be >= 0)
    - **unit**: Unit of measurement (e.g., 'pieces', 'kg', 'liters')
    
    This will automatically create an INSERT record in the history table.
    """
    try:
        return items_stock_crud.create(db=db, obj_in=item_in)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error creating item stock: {str(e)}")


@router.get("", response_model=ItemsStockResponse)
def get_items_stock(
    *,
    db: Session = Depends(get_db),
    # Pagination parameters
    page: int = Query(1, ge=1, description="Page number (starts from 1)"),
    page_size: int = Query(20, ge=1, le=100, description="Number of items per page"),
    
    # Filtering parameters
    item_id: Optional[UUID] = Query(None, description="Get specific item by ID"),
    name: Optional[str] = Query(None, description="Filter by name (partial match)"),
    unit: Optional[str] = Query(None, description="Filter by exact unit match"),
    unit_filter: Optional[str] = Query(None, description="Filter by unit (partial match)"),
    min_stock: Optional[int] = Query(None, ge=0, description="Minimum stock level"),
    max_stock: Optional[int] = Query(None, ge=0, description="Maximum stock level"),
    low_stock_threshold: Optional[int] = Query(None, ge=0, description="Get items with stock <= threshold"),
    
    # Response format
    return_list: bool = Query(False, description="Return simple list instead of paginated response")
):
    """
    Unified endpoint for retrieving items stock with various filtering options.
    
    **Basic Usage:**
    - `GET /items-stock/` - List all items (paginated)
    - `GET /items-stock/?item_id=<uuid>` - Get specific item by ID
    - `GET /items-stock/?name=widget` - Filter by name (partial match)
    - `GET /items-stock/?unit=pieces` - Get items with exact unit match
    - `GET /items-stock/?low_stock_threshold=10` - Get low stock items
    - `GET /items-stock/?return_list=true` - Get simple list (no pagination)
    """
    try:
        # Handle specific item lookup
        if item_id:
            item = items_stock_crud.get_by_id(db=db, item_id=item_id)
            if not item:
                raise HTTPException(status_code=404, detail="Item stock not found")
            
            if return_list:
                return ItemsStockResponse(
                    items=[item],
                    total=1,
                    page=1,
                    page_size=1,
                    has_next=False
                )
            else:
                return ItemsStockResponse(
                    items=[item],
                    total=1,
                    page=page,
                    page_size=page_size,
                    has_next=False
                )
        
        # Handle low stock threshold
        if low_stock_threshold is not None:
            items = items_stock_crud.get_low_stock_items(db=db, threshold=low_stock_threshold)
            if return_list:
                return ItemsStockResponse(
                    items=items,
                    total=len(items),
                    page=1,
                    page_size=len(items),
                    has_next=False
                )
            else:
                # Apply pagination to low stock results
                total = len(items)
                skip = (page - 1) * page_size
                paginated_items = items[skip:skip + page_size]
                has_next = (skip + page_size) < total
                
                return ItemsStockResponse(
                    items=paginated_items,
                    total=total,
                    page=page,
                    page_size=page_size,
                    has_next=has_next
                )
        
        # Handle exact unit match
        if unit:
            items = items_stock_crud.get_by_unit(db=db, unit=unit)
            if return_list:
                return ItemsStockResponse(
                    items=items,
                    total=len(items),
                    page=1,
                    page_size=len(items),
                    has_next=False
                )
            else:
                # Apply pagination to unit results
                total = len(items)
                skip = (page - 1) * page_size
                paginated_items = items[skip:skip + page_size]
                has_next = (skip + page_size) < total
                
                return ItemsStockResponse(
                    items=paginated_items,
                    total=total,
                    page=page,
                    page_size=page_size,
                    has_next=has_next
                )
        
        # Handle general filtering with pagination
        if return_list:
            # For list format, get all items (up to a reasonable limit)
            items, total = items_stock_crud.get_all_with_pagination(
                db=db,
                skip=0,
                limit=1000,  # Reasonable limit for list format
                name_filter=name,
                unit_filter=unit_filter,
                min_stock=min_stock,
                max_stock=max_stock
            )
            return ItemsStockResponse(
                items=items,
                total=total,
                page=1,
                page_size=total,
                has_next=False
            )
        else:
            # Standard paginated response
            skip = (page - 1) * page_size
            
            items, total = items_stock_crud.get_all_with_pagination(
                db=db,
                skip=skip,
                limit=page_size,
                name_filter=name,
                unit_filter=unit_filter,
                min_stock=min_stock,
                max_stock=max_stock
            )
            
            has_next = (skip + page_size) < total
            
            return ItemsStockResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
                has_next=has_next
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error retrieving items stock: {str(e)}")


@router.get("/{item_id}", response_model=ItemsStockWithHistory)
def get_item_stock_with_history(
    *,
    db: Session = Depends(get_db),
    item_id: UUID = Path(..., description="Item stock ID"),
    history_limit: int = Query(50, ge=1, le=200, description="Maximum history records to include")
):
    """
    Get a specific items stock entry with its change history.
    
    - **item_id**: Item stock ID
    - **history_limit**: Maximum number of history records to include (default: 50)
    """
    item = items_stock_crud.get_by_id(db=db, item_id=item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item stock not found")
    
    try:
        history, _ = history_crud.get_item_history(
            db=db, item_id=item_id, skip=0, limit=history_limit
        )
        
        history_read = [ItemsStockHistoryRead.model_validate(h) for h in history]
        
        # Converting the SQLAlchemy object to a dictionary for ItemsStockWithHistory
        item_dict = {
            "id": item.id,
            "name": item.name,
            "stock": item.stock,
            "unit": item.unit,
            "created_date": item.created_date,
            "updated_at": item.updated_at,
            "change": item.change,
            "last_stocked_at": item.last_stocked_at,
            "last_stock_addition": item.last_stock_addition,
            "stock_after_last_addition": item.stock_after_last_addition,
            "history": history_read
        }
        
        return ItemsStockWithHistory(**item_dict)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error retrieving item history: {str(e)}")


@router.put("/{item_id}", response_model=ItemsStockRead)
def update_item_stock(
    *,
    db: Session = Depends(get_db),
    item_id: UUID = Path(..., description="Item stock ID"),
    item_in: ItemsStockUpdate
):
    """
    Update an existing items stock entry.
    
    - **name**: New name for the stock item (optional)
    - **stock**: New stock quantity (optional, must be >= 0 if provided)
    - **unit**: New unit of measurement (optional)
    """
    item = items_stock_crud.update_by_id(db=db, item_id=item_id, obj_in=item_in)
    if not item:
        raise HTTPException(status_code=404, detail="Item stock not found")
    return item
