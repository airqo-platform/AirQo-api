from typing import List, Optional, Tuple, Union, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
import uuid as uuid_pkg
from fastapi import HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
import zlib
import io
import os
from intelhex import IntelHex
from google.cloud import storage

from app.crud.base import CRUDBase
from app.models.firmware import Firmware, FirmwareType
from app.schemas.firmware import FirmwareCreate, FirmwareUpdate
from app.utils.gcp_utils import load_gcp_credentials
from app.core.config import settings

class CRUDFirmware(CRUDBase[Firmware, FirmwareCreate, FirmwareUpdate]):
    def get(self, db: Session, id: uuid_pkg.UUID) -> Optional[Firmware]:
        """Get a firmware by its UUID"""
        return db.query(self.model).filter(self.model.id == id).first()
    
    def get_by_version(self, db: Session, *, firmware_version: str) -> Optional[Firmware]:
        """Get firmware by version string"""
        return db.query(self.model).filter(self.model.firmware_version == firmware_version).first()
    
    def get_by_type(self, db: Session, *, firmware_type: FirmwareType, skip: int = 0, limit: int = 100) -> List[Firmware]:
        """Get all firmware of a specific type"""
        return (
            db.query(self.model)
            .filter(self.model.firmware_type == firmware_type)
            .order_by(desc(self.model.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_latest(self, db: Session, *, firmware_type: Optional[FirmwareType] = None) -> Optional[Firmware]:
        """Get the latest firmware, optionally filtered by type"""
        query = db.query(self.model).order_by(desc(self.model.created_at))
        if firmware_type:
            query = query.filter(self.model.firmware_type == firmware_type)
        return query.first()
    
    def get_all(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Firmware]:
        """Get all firmware versions ordered by creation date"""
        return (
            db.query(self.model)
            .order_by(desc(self.model.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def upload_firmware(
        self,
        db: Session,
        *,
        firmware_data: dict,
        firmware_file: UploadFile,
        firmware_bootloader: Optional[UploadFile] = None,
        bucket_name: Optional[str] = None,
        credentials=None
    ) -> Firmware:
        """
        Upload firmware files to GCS and create database record.
        """
        # Check for duplicate version
        if self.get_by_version(db, firmware_version=firmware_data["firmware_version"]):
            raise HTTPException(
                status_code=400,
                detail=f"Firmware version {firmware_data['firmware_version']} already exists."
            )
        
        # Load credentials if not provided
        if credentials is None:
            credentials = load_gcp_credentials()
            if credentials is None:
                raise HTTPException(
                    status_code=500,
                    detail="Google Cloud Storage credentials not available. Please check your GCP configuration."
                )
        
        storage_client = storage.Client(credentials=credentials)
        bucket = storage_client.bucket(bucket_name or settings.GCS_BUCKET_NAME)
        
        firmware_version = firmware_data["firmware_version"]
        
        # Verify bucket access
        try:
            if not bucket.exists():
                raise HTTPException(
                    status_code=500,
                    detail=f"GCS bucket '{bucket.name}' does not exist."
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=500,
                detail=f"Error accessing GCS bucket: {str(e)}"
            )
        firmware_string = f'firmware/firmware_file_bin/{firmware_version}.bin'
        firmware_string_hex = None
        firmware_string_bootloader = None
        
        # Read firmware file
        firmware_content = firmware_file.file.read()
        bin_data_for_crc = None
        firmware_bin_size = 0
        
        if firmware_file.filename.endswith('.hex'):
            # Convert hex to bin and upload both
            try:
                firmware_content_str = firmware_content.decode('utf-8')
            except UnicodeDecodeError:
                firmware_content_str = firmware_content.decode('ascii', errors='ignore')
            
            bin_data = io.BytesIO()
            firmware_hex = IntelHex()
            firmware_hex.loadhex(io.StringIO(firmware_content_str))
            firmware_hex.tobinfile(bin_data)
            bin_data.seek(0)
            
            # Get binary data for CRC32 calculation
            bin_data_for_crc = bin_data.read()
            firmware_bin_size = len(bin_data_for_crc)
            bin_data.seek(0)  # Reset for upload
            
            # Upload bin
            bucket.blob(firmware_string).upload_from_file(bin_data)
            
            # Upload hex
            firmware_string_hex = f'firmware/firmware_file_hex/{firmware_version}.hex'
            bucket.blob(firmware_string_hex).upload_from_string(firmware_content)
        else:
            # For bin files, use the content directly
            bin_data_for_crc = firmware_content
            firmware_bin_size = len(bin_data_for_crc)
            # Only upload bin
            bucket.blob(firmware_string).upload_from_string(firmware_content)
        
        # Calculate CRC32 checksum from binary data
        crc32_checksum = format(zlib.crc32(bin_data_for_crc) & 0xffffffff, '08x')
        
        # Bootloader: always store as-is, no conversion
        if firmware_bootloader:
            firmware_bootloader_content = firmware_bootloader.file.read()
            firmware_string_bootloader = f'firmware/firmware_file_bootloader/{firmware_version}.hex'
            bucket.blob(firmware_string_bootloader).upload_from_string(firmware_bootloader_content)
        
        # Create DB record
        firmware_create = FirmwareCreate(
            firmware_version=firmware_data["firmware_version"],
            firmware_string=firmware_string,
            firmware_string_hex=firmware_string_hex,
            firmware_string_bootloader=firmware_string_bootloader,
            firmware_type=firmware_data.get("firmware_type", FirmwareType.beta),
            description=firmware_data.get("description"),
            crc32=crc32_checksum,
            firmware_bin_size=firmware_bin_size,
            change1=firmware_data.get("change1"),
            change2=firmware_data.get("change2"),
            change3=firmware_data.get("change3"),
            change4=firmware_data.get("change4"),
            change5=firmware_data.get("change5"),
            change6=firmware_data.get("change6"),
            change7=firmware_data.get("change7"),
            change8=firmware_data.get("change8"),
            change9=firmware_data.get("change9"),
            change10=firmware_data.get("change10"),
        )
        
        return self.create(db=db, obj_in=firmware_create)
    
    def download_firmware_file(
        self,
        db: Session,
        *,
        firmware_id: uuid_pkg.UUID,
        file_type: str,
        bucket_name: Optional[str] = None,
        credentials=None,
        range_start: Optional[int] = None,
        range_end: Optional[int] = None
    ) -> Tuple[bytes, int, str, Optional[int], Optional[int]]:
        """
        Download firmware file from GCS.
        """
        firmware = self.get(db, id=firmware_id)
        if not firmware:
            raise HTTPException(status_code=404, detail="Firmware not found.")
        
        # Determine which file to download
        if file_type == "bin":
            blob_path = firmware.firmware_string
        elif file_type == "hex":
            blob_path = firmware.firmware_string_hex
        elif file_type == "bootloader":
            blob_path = firmware.firmware_string_bootloader
        else:
            raise HTTPException(status_code=400, detail="Invalid file type. Must be 'bin', 'hex', or 'bootloader'.")
        
        if not blob_path:
            raise HTTPException(status_code=404, detail=f"Firmware {file_type} file not found.")
        
        # Load credentials if not provided
        if credentials is None:
            credentials = load_gcp_credentials()
            if credentials is None:
                raise HTTPException(
                    status_code=500,
                    detail="Google Cloud Storage credentials not available."
                )
        
        storage_client = storage.Client(credentials=credentials)
        bucket = storage_client.bucket(bucket_name or settings.GCS_BUCKET_NAME)
        blob = bucket.blob(blob_path)
        blob.reload()
        
        file_size = blob.size
        
        # Handle range requests
        if range_start is not None or range_end is not None:
            # Validate range
            if range_start is None:
                range_start = 0
            if range_end is None:
                range_end = file_size - 1
            
            # Ensure range is valid
            if range_start < 0 or range_end >= file_size or range_start > range_end:
                raise HTTPException(
                    status_code=416,
                    detail=f"Range not satisfiable. File size: {file_size}"
                )
            
            # Download the specified range
            file_data = blob.download_as_bytes(start=range_start, end=range_end + 1)
            return file_data, file_size, blob_path, range_start, range_end
        else:
            # Download entire file
            file_data = blob.download_as_bytes()
            return file_data, file_size, blob_path, None, None
    
    def download_firmware_file_by_version(
        self,
        db: Session,
        *,
        firmware_version: str,
        file_type: str,
        bucket_name: Optional[str] = None,
        credentials=None,
        range_start: Optional[int] = None,
        range_end: Optional[int] = None
    ) -> Tuple[bytes, int, str, Optional[int], Optional[int]]:
        """
        Download firmware file by version string.
        """
        firmware = self.get_by_version(db, firmware_version=firmware_version)
        if not firmware:
            raise HTTPException(
                status_code=404,
                detail=f"Firmware version {firmware_version} not found."
            )
        
        return self.download_firmware_file(
            db=db,
            firmware_id=firmware.id,
            file_type=file_type,
            bucket_name=bucket_name,
            credentials=credentials,
            range_start=range_start,
            range_end=range_end
        )

crud_firmware = CRUDFirmware(Firmware)
