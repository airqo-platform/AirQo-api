"""
Cronjob to update dim_site table from Platform API.
This script creates missing sites in dim_site that are referenced in dim_device.
"""
import sys
import os
from pathlib import Path
import requests
import logging
from typing import List, Dict, Any, Set
from datetime import datetime, timezone
from sqlmodel import Session, select
from dotenv import load_dotenv

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.configs.database import SessionLocal
from app.configs.settings import settings
from app.models.device import Device
from app.models.site import Site
from app.crud.site import CRUDSite

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Constants
PLATFORM_BASE_URL = settings.PLATFORM_BASE_URL
# Using the devices/sites endpoint to fetch site details
SITES_ENDPOINT = f"{PLATFORM_BASE_URL}/devices/sites"
API_TOKEN = settings.TOKEN
DEFAULT_TENANT = "airqo"
PAGE_LIMIT = 50

if not API_TOKEN:
    logger.warning("TOKEN not found in environment variables. API requests may fail.")

class SiteUpdater:
    def __init__(self, session: Session):
        self.session = session
        # Initialize CRUD with Site model
        self.crud = CRUDSite(Site)
        self.headers = {
            'Authorization': API_TOKEN,
            'Content-Type': 'application/json'
        }
        self.stats = {
            'missing_ids_count': 0,
            'fetched': 0,
            'created': 0,
            'errors': 0
        }

    def get_missing_site_ids(self) -> Set[str]:
        """Identify site_ids present in Device but missing in Site table."""
        try:
            logger.info("Identifying missing sites...")
            # Get all distinct site_ids from devices
            device_sites_query = select(Device.site_id).where(Device.site_id.is_not(None)).distinct()
            device_sites = set(self.session.exec(device_sites_query).all())
            
            # Get all distinct site_ids from sites
            existing_sites_query = select(Site.site_id).distinct()
            existing_sites = set(self.session.exec(existing_sites_query).all())
            
            missing_sites = device_sites - existing_sites
            self.stats['missing_ids_count'] = len(missing_sites)
            logger.info(f"Found {len(missing_sites)} missing sites out of {len(device_sites)} referenced by devices.")
            return missing_sites
        except Exception as e:
            logger.error(f"Error identifying missing sites: {e}")
            return set()

    def parse_site_from_api(self, api_site: Dict[str, Any]) -> Dict[str, Any]:
        """Convert API response to Site model fields."""
        site_category = api_site.get('site_category', {})
        category_val = site_category.get('category') if isinstance(site_category, dict) else None
        
        # Mapping API response to Site model
        return {
            "site_id": api_site.get('_id'),
            "site_name": api_site.get('name') or api_site.get('search_name') or "Unknown Site",
            "location_name": api_site.get('location_name'),
            "search_name": api_site.get('search_name'),
            "village": api_site.get('village'),
            # town is not explicitly in API response, leaving as None
            "town": None, 
            "city": api_site.get('city'),
            "district": api_site.get('district'),
            "country": api_site.get('country'),
            "data_provider": api_site.get('data_provider'),
            "site_category": category_val,
            "latitude": api_site.get('latitude'),
            "longitude": api_site.get('longitude'),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

    def fetch_and_create_missing_sites(self, missing_ids: Set[str]):
        """Fetch from API and create sites if they are in missing_ids."""
        if not missing_ids:
            logger.info("No missing sites to process.")
            return

        skip = 0
        remaining_ids = missing_ids.copy()
        
        try:
            while remaining_ids:
                params = {
                    'tenant': DEFAULT_TENANT,
                    'limit': PAGE_LIMIT,
                    'skip': skip
                }
                
                logger.info(f"Fetching sites: skip={skip}, limit={PAGE_LIMIT}")
                response = requests.get(SITES_ENDPOINT, params=params, headers=self.headers, timeout=30)
                response.raise_for_status()
                data = response.json()
                
                if not data.get('success'):
                    logger.error(f"API returned failure: {data.get('message')}")
                    break
                
                sites = data.get('sites', [])
                if not sites:
                    logger.info("No more sites returned from API.")
                    break
                
                self.stats['fetched'] += len(sites)
                
                # Process this batch
                batch_created_count = 0
                for site_data in sites:
                    site_id = site_data.get('_id')
                    
                    if site_id in remaining_ids:
                        try:
                            # Verify if it really doesn't exist (concurrency check)
                            existing = self.crud.get(self.session, id=site_id)
                            if not existing:
                                parsed_data = self.parse_site_from_api(site_data)
                                new_site = Site(**parsed_data)
                                self.session.add(new_site)
                                self.session.commit()
                                batch_created_count += 1
                                self.stats['created'] += 1
                                logger.info(f"Created site: {site_id} ({new_site.site_name})")
                            
                            if site_id in remaining_ids:
                                remaining_ids.remove(site_id)
                                
                        except Exception as e:
                            logger.error(f"Error creating site {site_id}: {e}")
                            self.session.rollback()
                            self.stats['errors'] += 1
                
                if batch_created_count > 0:
                    logger.info(f"Batch processed. Created {batch_created_count} sites. Remaining missing: {len(remaining_ids)}")
                
                meta = data.get('meta', {})
                total = meta.get('total', 0)
                
                # Stop if we found all missing IDs or reached end of pagination
                if not remaining_ids:
                    logger.info("Found all missing sites.")
                    break
                
                if not meta.get('nextPage') or (skip + len(sites)) >= total:
                    logger.info("Reached end of API results.")
                    break
                
                skip += PAGE_LIMIT

        except requests.RequestException as e:
            logger.error(f"Network error fetching sites: {e}")

    def run(self):
        logger.info("=" * 80)
        logger.info("Starting site update job")
        logger.info("=" * 80)
        
        missing_ids = self.get_missing_site_ids()
        
        if missing_ids:
            self.fetch_and_create_missing_sites(missing_ids)
        else:
            logger.info("All sites referenced in dim_device are present in dim_site.")
            
        logger.info("=" * 80)
        logger.info("Job completed")
        logger.info(f"Stats: Missing IDs identified: {self.stats['missing_ids_count']}")
        logger.info(f"       Sites fetched from API: {self.stats['fetched']}")
        logger.info(f"       Sites created: {self.stats['created']}")
        logger.info(f"       Errors: {self.stats['errors']}")
        logger.info("=" * 80)

if __name__ == "__main__":
    with SessionLocal() as session:
        updater = SiteUpdater(session)
        updater.run()
