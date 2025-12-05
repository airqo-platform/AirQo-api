from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlmodel import Session
from typing import Optional
from uuid import UUID
from app.crud.items_stock import items_stock as items_stock_crud, items_stock_history as history_crud
from app.models.items_stock import (
    ItemsStockCreate, ItemsStockRead, ItemsStockUpdate, ItemsStockWithHistory,
    ItemsStockResponse, ItemsStockHistoryRead
)
from app.deps import get_db

router = APIRouter()


@router.post("/", response_model=ItemsStockRead, status_code=201)
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


@router.get("/", response_model=ItemsStockResponse)
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
    
    **Parameters:**
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 20, max: 100)
    - **item_id**: Get specific item by ID (returns single item if found)
    - **name**: Filter by item name (partial/fuzzy match)
    - **unit**: Filter by exact unit match
    - **unit_filter**: Filter by unit (partial/fuzzy match)
    - **min_stock**: Filter items with stock >= this value
    - **max_stock**: Filter items with stock <= this value
    - **low_stock_threshold**: Get items with stock <= threshold
    - **return_list**: Return simple list format instead of paginated response
    
    **Filtering Logic:**
    - If `item_id` is provided, returns that specific item (ignores other filters)
    - If `unit` is provided, filters by exact unit match
    - If `low_stock_threshold` is provided, filters items with stock <= threshold
    - Multiple filters can be combined (except item_id which takes precedence)
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
        
        return ItemsStockWithHistory(
            **item.dict(),
            history=history_read
        )
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
    
    This will automatically create appropriate records in the history table:
    - STOCK_IN: if new stock > old stock
    - STOCK_OUT: if new stock < old stock  
    - UNIT_CHANGE: if only unit is changed
    """
    item = items_stock_crud.update_by_id(db=db, item_id=item_id, obj_in=item_in)
    if not item:
        raise HTTPException(status_code=404, detail="Item stock not found")
    return item


# # History endpoints

# @router.get("/{item_id}/history", response_model=ItemsStockHistoryResponse)
# def get_item_history(
#     *,
#     db: Session = Depends(get_db),
#     item_id: UUID = Path(..., description="Item stock ID"),
#     page: int = Query(1, ge=1, description="Page number (starts from 1)"),
#     page_size: int = Query(20, ge=1, le=100, description="Number of records per page")
# ):
#     """
#     Get change history for a specific item with pagination.
    
#     - **item_id**: Item stock ID
#     - **page**: Page number (default: 1)
#     - **page_size**: Records per page (default: 20, max: 100)
#     """
#     # First check if item exists
#     item = items_stock_crud.get_by_id(db=db, item_id=item_id)
#     if not item:
#         raise HTTPException(status_code=404, detail="Item stock not found")
    
#     skip = (page - 1) * page_size
    
#     try:
#         history, total = history_crud.get_item_history(
#             db=db, item_id=item_id, skip=skip, limit=page_size
#         )
        
#         has_next = (skip + page_size) < total
        
#         return ItemsStockHistoryResponse(
#             history=history,
#             total=total,
#             page=page,
#             page_size=page_size,
#             has_next=has_next
#         )
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=f"Error retrieving item history: {str(e)}")


# @router.get("/history/all", response_model=ItemsStockHistoryResponse)
# def get_all_history(
#     *,
#     db: Session = Depends(get_db),
#     page: int = Query(1, ge=1, description="Page number (starts from 1)"),
#     page_size: int = Query(20, ge=1, le=100, description="Number of records per page"),
#     change_type: Optional[ChangeType] = Query(None, description="Filter by change type")
# ):
#     """
#     Get all change history across all items with pagination and optional filtering.
    
#     - **page**: Page number (default: 1)
#     - **page_size**: Records per page (default: 20, max: 100)
#     - **change_type**: Filter by specific change type (INSERT, STOCK_IN, STOCK_OUT, UNIT_CHANGE, DELETE)
#     """
#     skip = (page - 1) * page_size
    
#     try:
#         history, total = history_crud.get_all_history_with_pagination(
#             db=db, skip=skip, limit=page_size, change_type_filter=change_type
#         )
        
#         has_next = (skip + page_size) < total
        
#         return ItemsStockHistoryResponse(
#             history=history,
#             total=total,
#             page=page,
#             page_size=page_size,
#             has_next=has_next
#         )
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=f"Error retrieving history: {str(e)}")


# @router.get("/history/movements", response_model=List[ItemsStockHistoryRead])
# def get_stock_movements(
#     *,
#     db: Session = Depends(get_db),
#     item_id: Optional[UUID] = Query(None, description="Filter by specific item ID")
# ):
#     """
#     Get only stock movement records (STOCK_IN and STOCK_OUT).
    
#     - **item_id**: Optional filter by specific item ID
#     """
#     try:
#         return history_crud.get_stock_movements(db=db, item_id=item_id)
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=f"Error retrieving stock movements: {str(e)}")


# @router.get("/analytics/movement-summary", response_model=List[StockMovementSummary])
# def get_movement_summary(
#     *,
#     db: Session = Depends(get_db)
# ):
#     """
#     Get summary of stock movements (total transactions and quantities by type).
    
#     Returns aggregated data showing:
#     - Transaction count by change type
#     - Total quantities moved by change type
#     """
#     try:
#         return history_crud.get_movement_summary(db=db)
#     except Exception as e:
#         raise HTTPException(status_code=400, detail=f"Error retrieving movement summary: {str(e)}")