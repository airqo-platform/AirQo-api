from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.schemas.device import MetaData


class SyncedGroupCohort(BaseModel):
    cohort_id: str
    name: Optional[str] = None


class SyncedGroup(BaseModel):
    group_id: str
    grp_title: str
    grp_status: Optional[str] = None
    organization_slug: Optional[str] = None
    grp_website: Optional[str] = None
    grp_industry: Optional[str] = None
    grp_country: Optional[str] = None
    grp_timezone: Optional[str] = None
    grp_profile_picture: Optional[str] = None
    number_of_users: int = 0
    number_of_cohorts: int = 0
    cohorts: List[SyncedGroupCohort] = []


class SyncedGroupResponse(BaseModel):
    success: bool
    message: str
    meta: Optional[MetaData] = None
    groups: List[SyncedGroup] = []


class SingleSyncedGroupResponse(BaseModel):
    success: bool
    message: str
    group: Optional[SyncedGroup] = None


class GroupSyncResponse(BaseModel):
    success: bool
    message: str
    groups_synced: Optional[int] = None
    groups_new: Optional[int] = None
    groups_updated: Optional[int] = None
    groups_unchanged: Optional[int] = None
