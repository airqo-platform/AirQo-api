from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class NetworkResponse(BaseModel):
    """A sensor manufacturer / data provider ("network" on the platform)."""
    network_id: Optional[str] = None      # platform _id; None when only seen on devices
    name: str
    acronym: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    data_source: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    profile_picture: Optional[str] = None
    platform_updated_at: Optional[datetime] = None
    enabled: bool = True                  # passes the ENABLED_NETWORKS allow-list
    total_devices: int = 0
    deployed_devices: int = 0
    online_devices: int = 0
    thingspeak_devices: int = 0           # devices beacon can read from ThingSpeak
    external_api_devices: int = 0         # devices readable through the manufacturer adapter


class NetworkListResponse(BaseModel):
    success: bool
    message: str
    total: int = 0
    networks: List[NetworkResponse] = []


class NetworkSyncResponse(BaseModel):
    success: bool
    message: str
    updates_count: Optional[int] = None
    new_count: Optional[int] = None
