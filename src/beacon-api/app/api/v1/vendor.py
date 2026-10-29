from typing import Optional, List, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.crud.crud_vendor import vendor as vendor_crud
from app.schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    VendorListResponse,
)

router = APIRouter()


@router.post("/", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor(
    *,
    db: Session = Depends(get_db),
    vendor_in: VendorCreate,
) -> Any:
    """
    Register a new hardware or equipment vendor.
    """
    existing = vendor_crud.get_by_name(db, name=vendor_in.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vendor with name '{vendor_in.name}' already exists.",
        )
    return vendor_crud.create(db, obj_in=vendor_in)


@router.get("/", response_model=VendorListResponse)
def list_vendors(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    name: Optional[str] = Query(None, description="Filter by name (partial match)"),
) -> Any:
    """
    List registered vendors with pagination and optional name filtering.
    """
    skip = (page - 1) * page_size
    items, total = vendor_crud.get_multi_paginated(
        db, skip=skip, limit=page_size, name_filter=name
    )
    return {
        "vendors": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": total > page * page_size,
    }


@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    *,
    db: Session = Depends(get_db),
    vendor_id: UUID = Path(..., description="Vendor UUID"),
) -> Any:
    """
    Get vendor details by ID.
    """
    v = vendor_crud.get(db, id=vendor_id)
    if not v:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{vendor_id}' not found.",
        )
    return v


@router.patch("/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    *,
    db: Session = Depends(get_db),
    vendor_id: UUID = Path(..., description="Vendor UUID"),
    vendor_in: VendorUpdate,
) -> Any:
    """
    Update vendor metadata.
    """
    v = vendor_crud.get(db, id=vendor_id)
    if not v:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{vendor_id}' not found.",
        )
    if vendor_in.name and vendor_in.name.lower() != v.name.lower():
        existing = vendor_crud.get_by_name(db, name=vendor_in.name)
        if existing and existing.id != v.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Vendor with name '{vendor_in.name}' already exists.",
            )
    return vendor_crud.update(db, db_obj=v, obj_in=vendor_in)


@router.delete("/{vendor_id}", response_model=VendorResponse)
def delete_vendor(
    *,
    db: Session = Depends(get_db),
    vendor_id: UUID = Path(..., description="Vendor UUID"),
) -> Any:
    """
    Delete a vendor by ID.
    """
    v = vendor_crud.get(db, id=vendor_id)
    if not v:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor with ID '{vendor_id}' not found.",
        )
    return vendor_crud.remove(db, id=vendor_id)
