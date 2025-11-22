"""Firmware management routes"""
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Response, Request, Query
from sqlmodel import Session
from typing import Optional, List
import uuid as uuid_pkg
import re
import os
import logging

from app.deps import get_db
from app.models.firmware import Firmware, FirmwareRead, FirmwareUpdate, FirmwareType
from app.crud.firmware import firmware as firmware_crud
from app.configs.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def validate_org_token(org_token: str) -> bool:
    """
    Validate organization token against the configured ORG_TOKEN.
    
    Args:
        org_token: Token to validate
        
    Returns:
        True if valid
        
    Raises:
        HTTPException: If token is invalid
    """
    if not settings.ORG_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="ORG_TOKEN not configured on server."
        )
    
    if org_token != settings.ORG_TOKEN:
        raise HTTPException(
            status_code=403,
            detail="Invalid organization token."
        )
    
    return True


def parse_range_header(range_header: Optional[str], file_size: int) -> Optional[tuple[int, int]]:
    """
    Parse HTTP Range header and return start and end byte positions.
    
    Args:
        range_header: Range header string (e.g., "bytes=0-1023")
        file_size: Total file size
        
    Returns:
        Tuple of (start, end) or None if invalid/not present
    """
    if not range_header:
        return None
    
    # Range header format: "bytes=start-end" or "bytes=start-" or "bytes=-suffix"
    range_match = re.match(r'bytes=(\d*)-(\d*)', range_header)
    if not range_match:
        return None  # Invalid format, ignore range
    
    start_str, end_str = range_match.groups()
    
    try:
        # Handle different range formats
        if start_str and end_str:
            start = int(start_str)
            end = int(end_str)
        elif start_str and not end_str:
            start = int(start_str)
            end = file_size - 1
        elif not start_str and end_str:
            # Last N bytes
            suffix_length = int(end_str)
            start = max(0, file_size - suffix_length)
            end = file_size - 1
        else:
            return None
        
        # Validate range
        if start < 0 or end >= file_size or start > end:
            raise HTTPException(
                status_code=416,
                detail=f"Range not satisfiable. File size: {file_size}"
            )
        
        return start, end
    except (ValueError, TypeError):
        return None  # Invalid numbers, ignore range


@router.post("/upload", response_model=FirmwareRead)
async def upload_firmware(
    firmware_version: str = Form(..., description="Firmware version (e.g., 1.0.0)"),
    firmware_type: FirmwareType = Form(FirmwareType.beta, description="Firmware type"),
    description: Optional[str] = Form(None, description="Firmware description"),
    change1: Optional[str] = Form(None, description="Change log entry 1"),
    change2: Optional[str] = Form(None, description="Change log entry 2"),
    change3: Optional[str] = Form(None, description="Change log entry 3"),
    change4: Optional[str] = Form(None, description="Change log entry 4"),
    change5: Optional[str] = Form(None, description="Change log entry 5"),
    change6: Optional[str] = Form(None, description="Change log entry 6"),
    change7: Optional[str] = Form(None, description="Change log entry 7"),
    change8: Optional[str] = Form(None, description="Change log entry 8"),
    change9: Optional[str] = Form(None, description="Change log entry 9"),
    change10: Optional[str] = Form(None, description="Change log entry 10"),
    firmware_file: UploadFile = File(..., description="Firmware file (.bin or .hex)"),
    firmware_bootloader: Optional[UploadFile] = File(None, description="Optional bootloader file (.hex)"),
    db: Session = Depends(get_db)
):
    """
    Upload firmware files to cloud storage and create database record.
    
    Accepts .bin or .hex firmware files. If .hex is provided, it will be converted to .bin automatically.
    """
    
    # Prepare firmware data
    firmware_data = {
        "firmware_version": firmware_version,
        "firmware_type": firmware_type,
        "description": description,
        "change1": change1,
        "change2": change2,
        "change3": change3,
        "change4": change4,
        "change5": change5,
        "change6": change6,
        "change7": change7,
        "change8": change8,
        "change9": change9,
        "change10": change10,
    }
    
    try:
        firmware = firmware_crud.upload_firmware(
            db=db,
            firmware_data=firmware_data,
            firmware_file=firmware_file,
            firmware_bootloader=firmware_bootloader,
            bucket_name=settings.GCS_BUCKET_NAME
        )
        logger.info(f"Successfully uploaded firmware version {firmware_version}")
        return firmware
    except Exception as e:
        logger.error(f"Failed to upload firmware: {e}")
        raise


@router.get("/", response_model=List[FirmwareRead])
def list_firmwares(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    firmware_type: Optional[FirmwareType] = Query(None, description="Filter by firmware type"),
    db: Session = Depends(get_db)
):
    """
    List all firmware versions.
    
    Optionally filter by firmware type.
    Results are ordered by creation date (newest first).
    """
    
    if firmware_type:
        firmwares = firmware_crud.get_by_type(
            db=db,
            firmware_type=firmware_type,
            skip=skip,
            limit=limit
        )
    else:
        firmwares = firmware_crud.get_all(db=db, skip=skip, limit=limit)
    
    return firmwares


@router.get("/latest", response_model=FirmwareRead)
def get_latest_firmware(
    firmware_type: Optional[FirmwareType] = Query(None, description="Filter by firmware type"),
    db: Session = Depends(get_db)
):
    """
    Get the latest firmware version.
    
    Optionally filter by firmware type.
    """
    
    firmware = firmware_crud.get_latest(db=db, firmware_type=firmware_type)
    if not firmware:
        raise HTTPException(status_code=404, detail="No firmware found.")
    
    return firmware


@router.get("/{firmware_id}", response_model=FirmwareRead)
def get_firmware(
    firmware_id: str,
    db: Session = Depends(get_db)
):
    """
    Get specific firmware by ID.
    """
    
    try:
        firmware_uuid = uuid_pkg.UUID(firmware_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid firmware_id format. Must be UUID.")
    
    firmware = firmware_crud.get(db=db, id=firmware_uuid)
    if not firmware:
        raise HTTPException(status_code=404, detail="Firmware not found.")
    
    return firmware


@router.get("/{firmware_id}/download/{file_type}")
def download_firmware_file_by_id(
    request: Request,
    firmware_id: str,
    file_type: str,
    db: Session = Depends(get_db)
):
    """
    Download firmware file by firmware ID.
    
    Args:
        firmware_id: UUID of the firmware
        file_type: Type of file to download ('bin', 'hex', or 'bootloader')
    
    Supports HTTP Range requests for partial downloads.
    """
    
    try:
        firmware_uuid = uuid_pkg.UUID(firmware_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid firmware_id format. Must be UUID.")
    
    # Get firmware first to check file size
    firmware = firmware_crud.get(db=db, id=firmware_uuid)
    if not firmware:
        raise HTTPException(status_code=404, detail="Firmware not found.")
    
    # Parse Range header if present
    range_header = request.headers.get("range")
    
    # First call to get file size
    file_data, file_size, blob_path, _, _ = firmware_crud.download_firmware_file(
        db=db,
        firmware_id=firmware_uuid,
        file_type=file_type,
        bucket_name=settings.GCS_BUCKET_NAME
    )
    
    # Parse range after we know file size
    range_result = parse_range_header(range_header, file_size)
    
    if range_result:
        range_start, range_end = range_result
        # Download with range
        file_data, file_size, blob_path, range_start, range_end = firmware_crud.download_firmware_file(
            db=db,
            firmware_id=firmware_uuid,
            file_type=file_type,
            bucket_name=settings.GCS_BUCKET_NAME,
            range_start=range_start,
            range_end=range_end
        )
        
        # Prepare response for partial content
        status_code = 206
        headers = {
            "Content-Disposition": f"attachment; filename={firmware.firmware_version}.{file_type if file_type != 'bootloader' else 'hex'}",
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {range_start}-{range_end}/{file_size}",
            "Content-Length": str(len(file_data)),
            "Cache-Control": "no-cache"
        }
    else:
        # Full file download
        status_code = 200
        headers = {
            "Content-Disposition": f"attachment; filename={firmware.firmware_version}.{file_type if file_type != 'bootloader' else 'hex'}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Cache-Control": "no-cache"
        }
    
    return Response(
        content=file_data,
        status_code=status_code,
        media_type="application/octet-stream",
        headers=headers
    )


@router.get("/download")
def download_firmware_file(
    request: Request,
    org_token: str = Query(..., description="Organization token"),
    file_type: str = Query(..., description="File type: 'bin', 'hex', or 'bootloader'"),
    firmware_id: Optional[str] = Query(None, description="Firmware UUID"),
    firmware_version: Optional[str] = Query(None, description="Firmware version string"),
    db: Session = Depends(get_db)
):
    """
    Download firmware file with flexible lookup.
    
    Provide either firmware_id OR firmware_version (not both).
    
    Args:
        org_token: Organization token
        file_type: Type of file to download ('bin', 'hex', or 'bootloader')
        firmware_id: Optional firmware UUID
        firmware_version: Optional firmware version string
    
    Supports HTTP Range requests for partial downloads.
    """
    # Validate organization token
    validate_org_token(org_token)
    
    # Validate that either firmware_id or firmware_version is provided
    if not firmware_id and not firmware_version:
        raise HTTPException(
            status_code=400,
            detail="Either firmware_id or firmware_version must be provided."
        )
    
    if firmware_id and firmware_version:
        raise HTTPException(
            status_code=400,
            detail="Provide either firmware_id or firmware_version, not both."
        )
    
    # Parse Range header if present
    range_header = request.headers.get("range")
    
    # Download by ID or version
    if firmware_id:
        try:
            firmware_uuid = uuid_pkg.UUID(firmware_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid firmware_id format. Must be UUID.")
        
        firmware = firmware_crud.get(db=db, id=firmware_uuid)
        if not firmware:
            raise HTTPException(status_code=404, detail="Firmware not found.")
        
        # First call to get file size
        file_data, file_size, blob_path, _, _ = firmware_crud.download_firmware_file(
            db=db,
            firmware_id=firmware_uuid,
            file_type=file_type,
            bucket_name=settings.GCS_BUCKET_NAME
        )
        
        # Parse range after we know file size
        range_result = parse_range_header(range_header, file_size)
        
        if range_result:
            range_start, range_end = range_result
            file_data, file_size, blob_path, range_start, range_end = firmware_crud.download_firmware_file(
                db=db,
                firmware_id=firmware_uuid,
                file_type=file_type,
                bucket_name=settings.GCS_BUCKET_NAME,
                range_start=range_start,
                range_end=range_end
            )
        else:
            range_start, range_end = None, None
    else:
        # Download by version
        firmware = firmware_crud.get_by_version(db=db, firmware_version=firmware_version)
        if not firmware:
            raise HTTPException(
                status_code=404,
                detail=f"Firmware version {firmware_version} not found."
            )
        
        # First call to get file size
        file_data, file_size, blob_path, _, _ = firmware_crud.download_firmware_file_by_version(
            db=db,
            firmware_version=firmware_version,
            file_type=file_type,
            bucket_name=settings.GCS_BUCKET_NAME
        )
        
        # Parse range after we know file size
        range_result = parse_range_header(range_header, file_size)
        
        if range_result:
            range_start, range_end = range_result
            file_data, file_size, blob_path, range_start, range_end = firmware_crud.download_firmware_file_by_version(
                db=db,
                firmware_version=firmware_version,
                file_type=file_type,
                bucket_name=settings.GCS_BUCKET_NAME,
                range_start=range_start,
                range_end=range_end
            )
        else:
            range_start, range_end = None, None
    
    # Prepare response
    filename = f"{firmware.firmware_version}.{file_type if file_type != 'bootloader' else 'hex'}"
    
    if range_start is not None and range_end is not None:
        # Partial content
        status_code = 206
        headers = {
            "Content-Disposition": f"attachment; filename={filename}",
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {range_start}-{range_end}/{file_size}",
            "Content-Length": str(len(file_data)),
            "Cache-Control": "no-cache"
        }
    else:
        # Full file
        status_code = 200
        headers = {
            "Content-Disposition": f"attachment; filename={filename}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Cache-Control": "no-cache"
        }
    
    return Response(
        content=file_data,
        status_code=status_code,
        media_type="application/octet-stream",
        headers=headers
    )


@router.patch("/{firmware_id}", response_model=FirmwareRead)
def update_firmware_type(
    firmware_id: str,
    firmware_update: FirmwareUpdate,
    db: Session = Depends(get_db)
):
    """
    Update firmware metadata (type, description, etc.).
    
    Args:
        firmware_id: UUID of the firmware
        firmware_update: Update data
    """
    
    try:
        firmware_uuid = uuid_pkg.UUID(firmware_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid firmware_id format. Must be UUID.")
    
    firmware = firmware_crud.get(db=db, id=firmware_uuid)
    if not firmware:
        raise HTTPException(status_code=404, detail="Firmware not found.")
    
    updated_firmware = firmware_crud.update(
        db=db,
        db_obj=firmware,
        obj_in=firmware_update
    )
    
    logger.info(f"Updated firmware {firmware_id}")
    return updated_firmware


# @router.delete("/{firmware_id}")
# def delete_firmware(
#     firmware_id: str,
#     org_token: str = Query(..., description="Organization token"),
#     db: Session = Depends(get_db)
# ):
#     """
#     Delete firmware record from database.
    
#     Note: This does not delete files from cloud storage.
    
#     Args:
#         firmware_id: UUID of the firmware
#         org_token: Organization token
#     """
#     # Validate organization token
#     validate_org_token(org_token)
    
#     try:
#         firmware_uuid = uuid_pkg.UUID(firmware_id)
#     except ValueError:
#         raise HTTPException(status_code=400, detail="Invalid firmware_id format. Must be UUID.")
    
#     firmware = firmware_crud.firmware.get(db=db, id=firmware_uuid)
#     if not firmware:
#         raise HTTPException(status_code=404, detail="Firmware not found.")
    
#     firmware_crud.firmware.remove(db=db, id=firmware_uuid)
    
#     logger.info(f"Deleted firmware {firmware_id}")
#     return {"message": f"Firmware {firmware_id} deleted successfully"}
