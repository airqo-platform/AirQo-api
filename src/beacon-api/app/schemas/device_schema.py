import json
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class MetricDefinitionBase(BaseModel):
    key: str
    unit: Optional[str] = None
    data_type: str = "float"
    expected_min: Optional[float] = None
    expected_max: Optional[float] = None
    max_rate_of_change: Optional[float] = None
    is_telemetry_field: bool = True


class MetricDefinitionCreate(MetricDefinitionBase):
    pass


class MetricDefinitionResponse(MetricDefinitionBase):
    id: UUID
    component_id: UUID

    model_config = ConfigDict(from_attributes=True)


class ComponentDefinitionBase(BaseModel):
    name: str
    component_type: str
    criticality: float = Field(default=1.0, ge=0.0, le=1.0)
    x_coordinate: Optional[float] = Field(default=None, description="Visual canvas X coordinate")
    y_coordinate: Optional[float] = Field(default=None, description="Visual canvas Y coordinate")
    meta_data: Optional[Dict[str, Any]] = None

    @field_validator("meta_data", mode="before")
    @classmethod
    def parse_component_meta(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class ComponentDefinitionCreate(ComponentDefinitionBase):
    metrics: Optional[List[MetricDefinitionCreate]] = None


class ComponentDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    component_type: Optional[str] = None
    criticality: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    x_coordinate: Optional[float] = None
    y_coordinate: Optional[float] = None
    meta_data: Optional[Dict[str, Any]] = None
    metrics: Optional[List[MetricDefinitionCreate]] = None

    @field_validator("meta_data", mode="before")
    @classmethod
    def parse_component_meta(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v


class ComponentDefinitionResponse(ComponentDefinitionBase):
    id: UUID
    profile_id: UUID
    metrics: List[MetricDefinitionResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def fallback_coordinates_from_metadata(cls, data: Any) -> Any:
        if hasattr(data, "x_coordinate") or hasattr(data, "meta_data"):
            x = getattr(data, "x_coordinate", None)
            y = getattr(data, "y_coordinate", None)
            meta = getattr(data, "meta_data", None) or getattr(data, "metadata", None)
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            if isinstance(meta, dict):
                if x is None and "x_coordinate" in meta:
                    try:
                        x = float(meta["x_coordinate"])
                    except (ValueError, TypeError):
                        pass
                if y is None and "y_coordinate" in meta:
                    try:
                        y = float(meta["y_coordinate"])
                    except (ValueError, TypeError):
                        pass
                return {
                    "id": getattr(data, "id"),
                    "profile_id": getattr(data, "profile_id"),
                    "name": getattr(data, "name"),
                    "component_type": getattr(data, "component_type"),
                    "criticality": getattr(data, "criticality", 1.0),
                    "x_coordinate": x,
                    "y_coordinate": y,
                    "meta_data": meta,
                    "metrics": getattr(data, "metrics", []),
                }
        elif isinstance(data, dict):
            meta = data.get("meta_data") or data.get("metadata")
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    meta = {}
            if isinstance(meta, dict):
                if data.get("x_coordinate") is None and "x_coordinate" in meta:
                    try:
                        data["x_coordinate"] = float(meta["x_coordinate"])
                    except (ValueError, TypeError):
                        pass
                if data.get("y_coordinate") is None and "y_coordinate" in meta:
                    try:
                        data["y_coordinate"] = float(meta["y_coordinate"])
                    except (ValueError, TypeError):
                        pass
        return data


# Convenience aliases
ComponentBase = ComponentDefinitionBase
ComponentCreate = ComponentDefinitionCreate
ComponentUpdate = ComponentDefinitionUpdate
ComponentResponse = ComponentDefinitionResponse
MetricResponse = MetricDefinitionResponse


class ComponentRelationshipBase(BaseModel):
    source_component_id: UUID
    target_component_id: UUID
    relationship_type: str  # POWERS, COMMUNICATES_VIA, MEASURES_SAME_AS, COOLS


class ComponentRelationshipCreate(ComponentRelationshipBase):
    pass


class ComponentRelationshipResponse(ComponentRelationshipBase):
    id: UUID
    profile_id: UUID

    model_config = ConfigDict(from_attributes=True)


from app.schemas.vendor import VendorResponse


class DeviceProfileBase(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    vendor_id: Optional[UUID] = None
    meta_data: Optional[Dict[str, Any]] = None
    telemetry_mappings: Dict[str, Any] = {}
    config_mappings: Dict[str, Any] = {}
    metadata_mappings: Dict[str, Any] = {}

    @field_validator("meta_data", "telemetry_mappings", "config_mappings", "metadata_mappings", mode="before")
    @classmethod
    def parse_json_strings(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        if v is None:
            return {}
        return v


class DeviceProfileCreate(DeviceProfileBase):
    components: Optional[List[ComponentDefinitionCreate]] = None


class DeviceProfileResponse(DeviceProfileBase):
    id: UUID
    vendor: Optional[VendorResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    components: List[ComponentDefinitionResponse] = []
    relationships: List[ComponentRelationshipResponse] = []

    model_config = ConfigDict(from_attributes=True)


class DeviceProfileUpdateSchema(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    vendor: Optional[Any] = None
    vendor_id: Optional[Union[UUID, str]] = None
    description: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    telemetry_mappings: Optional[Dict[str, Any]] = None
    config_mappings: Optional[Dict[str, Any]] = None
    metadata_mappings: Optional[Dict[str, Any]] = None
    components: Optional[List[Dict[str, Any]]] = None
    relationships: Optional[List[Dict[str, Any]]] = None

    @field_validator("meta_data", "telemetry_mappings", "config_mappings", "metadata_mappings", mode="before")
    @classmethod
    def parse_json_fields(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return v

    @field_validator("components", "relationships", mode="before")
    @classmethod
    def parse_json_lists(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        return v


DeviceProfileUpdate = DeviceProfileUpdateSchema

