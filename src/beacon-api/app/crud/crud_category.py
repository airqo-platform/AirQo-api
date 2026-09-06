from typing import List, Optional, Tuple, Dict, Any, Union
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.models.device_schema import DeviceProfile
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryRead
from app.utils.field_mappings import ensure_dict, extract_label


def profile_to_category_read(profile: DeviceProfile) -> CategoryRead:
    """Dynamically converts a DeviceProfile instance into the legacy CategoryRead schema."""
    telemetry_map = ensure_dict(profile.telemetry_mappings)
    config_map = ensure_dict(profile.config_mappings)
    meta_map = ensure_dict(profile.metadata_mappings)

    cat_dict = {
        "name": profile.name,
        "level": profile.category,
        "description": profile.description,
        "created_at": profile.created_at or datetime.now(timezone.utc),
        "updated_at": profile.updated_at or datetime.now(timezone.utc),
    }
    for i in range(1, 16):
        f_label = extract_label(telemetry_map.get(f"field{i}"))
        if f_label is not None:
            cat_dict[f"field{i}"] = f_label
        m_label = extract_label(meta_map.get(f"metadata{i}"))
        if m_label is not None:
            cat_dict[f"metadata{i}"] = m_label
    for i in range(1, 11):
        c_label = extract_label(config_map.get(f"config{i}"))
        if c_label is not None:
            cat_dict[f"config{i}"] = c_label

    return CategoryRead(**cat_dict)


SUPPORTED_FIELDS = (
    {"description", "level"}
    | {f"field{i}" for i in range(1, 16)}
    | {f"metadata{i}" for i in range(1, 16)}
    | {f"config{i}" for i in range(1, 11)}
)


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

    def update(
        self,
        db: Session,
        *,
        db_obj: CategoryRead,
        obj_in: Union[CategoryUpdate, Dict[str, Any]],
    ) -> CategoryRead:
        if hasattr(obj_in, "model_dump"):
            update_data = obj_in.model_dump(exclude_unset=True)
            if getattr(obj_in, "__pydantic_extra__", None):
                update_data.update(obj_in.__pydantic_extra__)
        elif hasattr(obj_in, "dict"):
            update_data = obj_in.dict(exclude_unset=True)
            if getattr(obj_in, "__pydantic_extra__", None):
                update_data.update(obj_in.__pydantic_extra__)
        elif isinstance(obj_in, dict):
            update_data = dict(obj_in)
        else:
            update_data = {}

        unsupported = set(update_data.keys()) - SUPPORTED_FIELDS
        if unsupported:
            raise ValueError(f"Unsupported field(s) for category update: {', '.join(sorted(unsupported))}")

        profile = db.query(DeviceProfile).filter(DeviceProfile.name.ilike(db_obj.name)).first()
        if not profile:
            return db_obj

        if not update_data:
            return profile_to_category_read(profile)

        if "description" in update_data:
            profile.description = update_data["description"]

        if "level" in update_data:
            if update_data["level"] is not None:
                profile.category = update_data["level"]

        telemetry_map = dict(ensure_dict(profile.telemetry_mappings))
        telemetry_changed = False
        for i in range(1, 16):
            key = f"field{i}"
            if key in update_data:
                val = update_data[key]
                if val is None:
                    telemetry_map.pop(key, None)
                else:
                    slot = dict(telemetry_map[key]) if isinstance(telemetry_map.get(key), dict) else {}
                    slot["label"] = val
                    telemetry_map[key] = slot
                telemetry_changed = True

        if telemetry_changed:
            profile.telemetry_mappings = telemetry_map
            flag_modified(profile, "telemetry_mappings")

        meta_map = dict(ensure_dict(profile.metadata_mappings))
        meta_changed = False
        for i in range(1, 16):
            key = f"metadata{i}"
            if key in update_data:
                val = update_data[key]
                if val is None:
                    meta_map.pop(key, None)
                else:
                    slot = dict(meta_map[key]) if isinstance(meta_map.get(key), dict) else {}
                    slot["label"] = val
                    meta_map[key] = slot
                meta_changed = True

        if meta_changed:
            profile.metadata_mappings = meta_map
            flag_modified(profile, "metadata_mappings")

        config_map = dict(ensure_dict(profile.config_mappings))
        config_changed = False
        for i in range(1, 11):
            key = f"config{i}"
            if key in update_data:
                val = update_data[key]
                if val is None:
                    config_map.pop(key, None)
                else:
                    slot = dict(config_map[key]) if isinstance(config_map.get(key), dict) else {}
                    slot["label"] = val
                    config_map[key] = slot
                config_changed = True

        if config_changed:
            profile.config_mappings = config_map
            flag_modified(profile, "config_mappings")

        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile_to_category_read(profile)


category = CRUDCategory()
