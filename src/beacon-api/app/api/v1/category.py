from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.crud.crud_category import category as category_crud
from app.schemas.category import (
    CategoryRead,
    CategoryUpdate,
    CategoryResponse,
)

router = APIRouter()

@router.get("/", response_model=CategoryResponse)
def list_categories(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    name: Optional[str] = Query(None, description="Filter by name (partial match)"),
):
    """
    List categories with pagination and optional filtering.
    """
    skip = (page - 1) * page_size
    items, total = category_crud.get_multi_paginated(
        db, skip=skip, limit=page_size, name_filter=name
    )
    
    return {
        "categories": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": total > page * page_size,
    }

@router.get("/{name}", response_model=CategoryRead)
def get_category(
    name: str = Path(..., description="The name of the category"),
    db: Session = Depends(get_db),
):
    """
    Get a specific category by name.
    """
    category = category_crud.get_by_name(db, name=name)
        
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with name '{name}' not found",
        )
    return category

@router.put("/{name}", response_model=CategoryRead)
def update_category(
    *,
    db: Session = Depends(get_db),
    name: str = Path(..., description="The name of the category to update"),
    category_in: CategoryUpdate,
):
    """
    Update a category.
    """
    category = category_crud.get_by_name(db, name=name)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category with name '{name}' not found",
        )
    return category_crud.update(db, db_obj=category, obj_in=category_in)
