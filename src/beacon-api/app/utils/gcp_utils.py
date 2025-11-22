"""Google Cloud Platform utilities for GCS operations"""
import os
import json
import logging
from typing import Optional
from pathlib import Path
from google.oauth2 import service_account
from google.cloud import storage

logger = logging.getLogger(__name__)


def load_gcp_credentials() -> Optional[service_account.Credentials]:
    """
    Load GCP credentials using multiple methods in order of preference:
    1. GOOGLE_APPLICATION_CREDENTIALS environment variable (file path)
    2. service-account.json file in project root
    3. GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable (JSON string)
    
    Returns:
        Credentials object or None if credentials are not available
    """
    # Method 1: Standard GOOGLE_APPLICATION_CREDENTIALS file path
    credentials_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if credentials_file:
        credentials_path = Path(credentials_file)
        if credentials_path.exists():
            try:
                credentials = service_account.Credentials.from_service_account_file(str(credentials_path))
                logger.info(f"Loaded GCP credentials from GOOGLE_APPLICATION_CREDENTIALS: {credentials_file}")
                return credentials
            except Exception as e:
                logger.warning(f"Failed to load credentials from {credentials_file}: {e}")
    
    # Method 2: Default service-account.json in project root
    default_creds_path = Path("service-account.json")
    if default_creds_path.exists():
        try:
            credentials = service_account.Credentials.from_service_account_file(str(default_creds_path))
            logger.info(f"Loaded GCP credentials from default file: {default_creds_path}")
            return credentials
        except Exception as e:
            logger.warning(f"Failed to load credentials from {default_creds_path}: {e}")
    
    # Method 3: Fallback to JSON string in environment variable
    credentials_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if credentials_json:
        try:
            credentials_dict = json.loads(credentials_json)
            credentials = service_account.Credentials.from_service_account_info(credentials_dict)
            logger.info("Loaded GCP credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON")
            return credentials
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON: {e}")
    
    logger.warning("No GCP credentials found. Set GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS")
    return None


def get_storage_client(credentials: Optional[service_account.Credentials] = None) -> Optional[storage.Client]:
    """
    Get Google Cloud Storage client.
    
    Args:
        credentials: Optional credentials. If not provided, will attempt to load from environment.
    
    Returns:
        Storage client or None if credentials are not available
    """
    if credentials is None:
        credentials = load_gcp_credentials()
    
    if credentials is None:
        return None
    
    try:
        return storage.Client(credentials=credentials)
    except Exception as e:
        logger.error(f"Failed to create storage client: {e}")
        return None
