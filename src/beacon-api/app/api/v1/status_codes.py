from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.status_codes import (
    StatusCodeSetCreate,
    StatusCodeSetResponse,
    StatusCodeSetUpdate,
    StatusDecodeResponse,
)
from app.services import status_codes
from app.services.status_codes import StatusCodeSetError, StatusCodeSetNameTaken

router = APIRouter()

MAX_DECODE_VALUES = 1000


def _get_or_404(db: Session, ref: str):
    code_set = status_codes.get_code_set(db, ref)
    if not code_set:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Status code set '{ref}' not found")
    return code_set


def _raise_for(error: StatusCodeSetError):
    code = status.HTTP_409_CONFLICT if isinstance(error, StatusCodeSetNameTaken) else status.HTTP_422_UNPROCESSABLE_ENTITY
    raise HTTPException(status_code=code, detail=error.errors)


@router.get("/", response_model=List[StatusCodeSetResponse])
def list_status_code_sets(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    search: Optional[str] = Query(default=None, description="Match on set name"),
    db: Session = Depends(get_db),
) -> Any:
    """List status code sets with their codes."""
    return status_codes.list_code_sets(db, skip=skip, limit=limit, search=search)


@router.post("/", response_model=StatusCodeSetResponse, status_code=status.HTTP_201_CREATED)
def create_status_code_set(payload: StatusCodeSetCreate, db: Session = Depends(get_db)) -> Any:
    """
    Define a device type's status codes and how to read a reported value. With the ``bitmask``
    rule each code must be a single bit (1, 2, 4, ...) and code 0 is the "nothing set" state.
    """
    try:
        return status_codes.create_code_set(db, payload)
    except StatusCodeSetError as error:
        _raise_for(error)


@router.get("/{ref}", response_model=StatusCodeSetResponse)
def get_status_code_set(ref: str, db: Session = Depends(get_db)) -> Any:
    """Fetch a status code set by ID or name, e.g. ``bam-1020``."""
    return _get_or_404(db, ref)


@router.put("/{ref}", response_model=StatusCodeSetResponse)
@router.patch("/{ref}", response_model=StatusCodeSetResponse)
def update_status_code_set(ref: str, payload: StatusCodeSetUpdate, db: Session = Depends(get_db)) -> Any:
    """Update a set. Fields left out are kept; ``codes``, when given, replaces the whole list."""
    code_set = _get_or_404(db, ref)
    try:
        return status_codes.update_code_set(db, code_set, payload)
    except StatusCodeSetError as error:
        _raise_for(error)


@router.delete("/{ref}", status_code=status.HTTP_200_OK)
def delete_status_code_set(ref: str, db: Session = Depends(get_db)) -> Any:
    """Delete a status code set and its codes."""
    code_set = _get_or_404(db, ref)
    status_codes.delete_code_set(db, code_set)
    return {"success": True, "message": f"Status code set '{ref}' deleted successfully"}


@router.get("/{ref}/decode", response_model=StatusDecodeResponse)
def decode_status_values(
    ref: str,
    value: List[str] = Query(..., description="Reported value(s) to translate; repeat for several, e.g. ?value=17&value=144"),
    db: Session = Depends(get_db),
) -> Any:
    """
    Translate reported status values into their codes, e.g. BAM-1020 ``17`` → Tape Break (1) +
    Flow Failure (16). Each result's ``status`` is the most serious kind among its codes
    (``fault`` > ``unknown`` > ``info`` > ``ok``), or ``invalid`` for a value that is not a
    non-negative whole number.
    """
    if len(value) > MAX_DECODE_VALUES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"At most {MAX_DECODE_VALUES} values can be decoded per request.",
        )
    code_set = _get_or_404(db, ref)
    return {
        "code_set": code_set.name,
        "decode_rule": code_set.decode_rule,
        "results": status_codes.decode_values(code_set, value),
    }
