from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from typing import List, Optional
from app.crud.category import category as category_crud
from app.models.category import CategoryCreate, CategoryRead, CategoryWithDevices
from app.deps import get_db

router = APIRouter()


@router.post("/", response_model=CategoryRead, status_code=201)
def create_category(
    *,
    db: Session = Depends(get_db),
    category_in: CategoryCreate
):
    """
    Create a new category.
    
    - **name**: Unique category name (required)
    - **description**: Optional description
    - **fields**: Optional dictionary of field1-field15 key-value pairs
    - **configs**: Optional dictionary of config1-config10 key-value pairs
    - **metadata**: Optional dictionary of metadata1-metadata15 key-value pairs
    """
    return category_crud.create(db=db, obj_in=category_in)


@router.get("/", response_model=List[CategoryRead])
def list_categories(
    *,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """
    Retrieve all categories with pagination.
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    """
    return category_crud.get_all(db=db, skip=skip, limit=limit)


@router.get("/{category_name}", response_model=CategoryWithDevices)
def get_category(
    *,
    db: Session = Depends(get_db),
    category_name: str,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(25, ge=1, le=1000, description="Maximum number of devices to return"),
    network: Optional[str] = Query(None, description="Filter devices by network"),
    search: Optional[str] = Query(None, description="Search devices by name, device_id, or site_id")
):
    """
    Retrieve a specific category by name, including associated devices and their recent configs.
    
    - **category_name**: The name (primary key) of the category
    - **skip**: Number of device records to skip (for pagination)
    - **limit**: Maximum number of devices to return (default: 25)
    - **network**: Filter devices by network (optional)
    - **search**: Search devices by name, device_id, or site_id (optional)
    """
    category = category_crud.get_with_devices(
        db=db, 
        id=category_name,
        skip=skip,
        limit=limit,
        network=network,
        search=search
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


# @router.get("/by-name/{category_name}", response_model=CategoryRead)
# def get_category_by_name(
#     *,
#     db: Session = Depends(get_db),
#     category_name: str
# ):
#     """
#     Retrieve a specific category by its unique name.
    
#     - **category_name**: The unique name of the category
#     """
#     category = category_crud.get_by_name(db=db, name=category_name)
#     if not category:
#         raise HTTPException(status_code=404, detail="Category not found")
#     return category_crud._to_category_read(category)
