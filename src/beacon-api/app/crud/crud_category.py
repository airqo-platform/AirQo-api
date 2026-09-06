from typing import List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.device_schema import DeviceProfile
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryRead


def profile_to_category_read(profile: DeviceProfile) -> CategoryRead:
    """Dynamically converts a DeviceProfile instance into the legacy CategoryRead schema."""
    telemetry_map = profile.telemetry_mappings or {}
    config_map = profile.config_mappings or {}
    meta_map = profile.metadata_mappings or {}

    cat_dict = {
        "name": profile.name,
        "level": profile.category,
        "description": profile.description,
        "created_at": profile.created_at or datetime.now(timezone.utc),
        "updated_at": profile.updated_at or datetime.now(timezone.utc),
    }
    for i in range(1, 16):
        f_info = telemetry_map.get(f"field{i}")
        if f_info:
            cat_dict[f"field{i}"] = f_info.get("label") if isinstance(f_info, dict) else str(f_info)
        m_info = meta_map.get(f"metadata{i}")
        if m_info:
            cat_dict[f"metadata{i}"] = m_info.get("label") if isinstance(m_info, dict) else str(m_info)
    for i in range(1, 11):
        c_info = config_map.get(f"config{i}")
        if c_info:
            cat_dict[f"config{i}"] = c_info.get("label") if isinstance(c_info, dict) else str(c_info)

    return CategoryRead(**cat_dict)


class CRUDCategory:
    """Compatibility bridge translating legacy category queries to DeviceProfile."""

    def get_by_name(self, db: Session, *, name: str) -> Optional[CategoryRead]:
        profile = db.query(DeviceProfile).filter(DeviceProfile.name.ilike(name)).first()
        if not profile:
            return None
        return profile_to_category_read(profile)

    def get_multi_paginated(
        self, db: Session, *, skip: int = 0, limit: int = 100, name_filter: Optional[str] = None
    ) -> Tuple[List[CategoryRead], int]:
        query = db.query(DeviceProfile)
        if name_filter:
            query = query.filter(DeviceProfile.name.ilike(f"%{name_filter}%"))

        total = query.count()
        profiles = query.offset(skip).limit(limit).all()
        items = [profile_to_category_read(p) for p in profiles]
        return items, total

    def update(self, db: Session, *, db_obj: CategoryRead, obj_in: CategoryUpdate) -> CategoryRead:
        profile = db.query(DeviceProfile).filter(DeviceProfile.name.ilike(db_obj.name)).first()
        if profile and obj_in.description:
            profile.description = obj_in.description
            db.add(profile)
            db.commit()
            db.refresh(profile)
            return profile_to_category_read(profile)
        return db_obj


category = CRUDCategory()
