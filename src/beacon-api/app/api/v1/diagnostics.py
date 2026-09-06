from typing import List, Optional, Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.crud.crud_diagnostics import crud_diagnostics
from app.schemas.device_schema import (
    DeviceProfileCreate,
    DeviceProfileResponse,
    DeviceProfileUpdateSchema,
    ComponentDefinitionCreate,
    ComponentDefinitionUpdate,
    ComponentDefinitionResponse,
)
from app.schemas.diagnostics import (
    DiagnosticTemplateCreate,
    DiagnosticTemplateResponse,
    EvaluationRequest,
    EvaluationResultResponse,
    DeviceHealthSnapshotResponse,
    DiagnosticFeedbackCreate,
    DiagnosticFeedbackResponse,
)
from app.services.diagnostics.evaluator import DiagnosticEvaluator
from app.services.diagnostics.seeds import seed_default_templates, get_default_candidate_causes
from app.models.sync import SyncDevice
from app.utils.field_mappings import map_record_from_profile, normalize_and_unpack_record

router = APIRouter()
evaluator = DiagnosticEvaluator()


# ── Seed Defaults ─────────────────────────────────────────────────────────────

@router.post("/seed-defaults", summary="Seed standard IoT profiles and diagnostic templates")
def seed_defaults(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Populates standard diagnostic templates (PM sensors, LiFePO4 battery, Solar, Cold Chain)."""
    return seed_default_templates(db)


# ── Device Profiles ───────────────────────────────────────────────────────────

@router.post("/profiles", response_model=DeviceProfileResponse, status_code=status.HTTP_201_CREATED)
def create_device_profile(
    profile_in: DeviceProfileCreate,
    db: Session = Depends(get_db),
) -> Any:
    """Register a new IoT device profile with its component hierarchy and metrics."""
    existing = crud_diagnostics.get_profile_by_name(db, profile_in.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"DeviceProfile with name '{profile_in.name}' already exists.",
        )
    return crud_diagnostics.create_profile(db, profile_in)


@router.get("/profiles", response_model=List[DeviceProfileResponse])
def list_device_profiles(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    vendor_id: Optional[UUID] = Query(None, description="Filter profiles by vendor UUID"),
    db: Session = Depends(get_db),
) -> Any:
    """List all registered IoT device profiles."""
    return crud_diagnostics.list_profiles(db, skip=skip, limit=limit, category=category, vendor_id=vendor_id)


@router.get("/profiles/{profile_id}", response_model=DeviceProfileResponse)
def get_device_profile(
    profile_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """Fetch details and component topology for a specific device profile."""
    profile = crud_diagnostics.get_profile(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device profile '{profile_id}' not found",
        )
    return profile


@router.put("/profiles/{profile_id}", response_model=DeviceProfileResponse)
@router.patch("/profiles/{profile_id}", response_model=DeviceProfileResponse)
async def update_device_profile(
    profile_id: str,
    payload: DeviceProfileUpdateSchema,
    db: Session = Depends(get_db),
) -> Any:
    """
    Updates an existing device profile including:
    - Header & metadata (name, category, vendor, description, meta_data)
    - Dynamic ingestion slot mappings (telemetry_mappings, config_mappings, metadata_mappings)
    - Subsystem component trees & metric thresholds (components)
    - Topological relationships (relationships)
    """
    profile = crud_diagnostics.get_profile(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device profile '{profile_id}' not found",
        )
    return crud_diagnostics.update_profile(db, db_obj=profile, obj_in=payload)


@router.delete("/profiles/{profile_id}", status_code=status.HTTP_200_OK)
async def delete_device_profile(
    profile_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """Deletes a device profile by ID."""
    profile = crud_diagnostics.get_profile(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device profile '{profile_id}' not found",
        )
    crud_diagnostics.delete_profile(db, db_obj=profile)
    return {"success": True, "message": f"Profile '{profile_id}' deleted successfully"}


# ── Subsystem Components ──────────────────────────────────────────────────────

@router.get("/profiles/{profile_id}/components", response_model=List[ComponentDefinitionResponse])
def list_profile_components(
    profile_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """List all subsystem components belonging to a device profile, including visual canvas coordinates."""
    profile = crud_diagnostics.get_profile(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device profile '{profile_id}' not found",
        )
    return crud_diagnostics.list_components(db, profile_id=profile.id)


@router.post("/profiles/{profile_id}/components", response_model=ComponentDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_profile_component(
    profile_id: str,
    component_in: ComponentDefinitionCreate,
    db: Session = Depends(get_db),
) -> Any:
    """Create a new subsystem component with optional visual canvas coordinates (x_coordinate, y_coordinate)."""
    profile = crud_diagnostics.get_profile(db, profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device profile '{profile_id}' not found",
        )
    return crud_diagnostics.create_component(db, profile_id=profile.id, obj_in=component_in)


@router.get("/profiles/{profile_id}/components/{component_id}", response_model=ComponentDefinitionResponse)
def get_profile_component(
    profile_id: str,
    component_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """Fetch details of a specific subsystem component with its visual canvas coordinates."""
    component = crud_diagnostics.get_component(db, profile_id=profile_id, component_id=component_id)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Component '{component_id}' in profile '{profile_id}' not found",
        )
    return component


@router.put("/profiles/{profile_id}/components/{component_id}", response_model=ComponentDefinitionResponse)
@router.patch("/profiles/{profile_id}/components/{component_id}", response_model=ComponentDefinitionResponse)
def update_profile_component(
    profile_id: str,
    component_id: str,
    component_in: ComponentDefinitionUpdate,
    db: Session = Depends(get_db),
) -> Any:
    """Update a subsystem component, including its visual canvas coordinates (x_coordinate, y_coordinate)."""
    component = crud_diagnostics.get_component(db, profile_id=profile_id, component_id=component_id)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Component '{component_id}' in profile '{profile_id}' not found",
        )
    return crud_diagnostics.update_component(db, db_obj=component, obj_in=component_in)


@router.delete("/profiles/{profile_id}/components/{component_id}", status_code=status.HTTP_200_OK)
def delete_profile_component(
    profile_id: str,
    component_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """Delete a subsystem component from a device profile."""
    component = crud_diagnostics.get_component(db, profile_id=profile_id, component_id=component_id)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Component '{component_id}' in profile '{profile_id}' not found",
        )
    crud_diagnostics.delete_component(db, db_obj=component)
    return {"success": True, "message": f"Component '{component_id}' deleted successfully"}


# ── Diagnostic Templates ──────────────────────────────────────────────────────

@router.post("/templates", response_model=DiagnosticTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_diagnostic_template(
    template_in: DiagnosticTemplateCreate,
    db: Session = Depends(get_db),
) -> Any:
    """Create a reusable diagnostic template with symptoms, causes, and evidential weighting rules."""
    return crud_diagnostics.create_template(db, template_in)


@router.get("/templates", response_model=List[DiagnosticTemplateResponse])
def list_diagnostic_templates(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> Any:
    """List all registered diagnostic templates."""
    return crud_diagnostics.list_templates(db, skip=skip, limit=limit)


@router.get("/templates/{template_id}", response_model=DiagnosticTemplateResponse)
def get_diagnostic_template(
    template_id: UUID,
    db: Session = Depends(get_db),
) -> Any:
    """Fetch a diagnostic template with its complete rule tree."""
    template = crud_diagnostics.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found.")
    return template


# ── Real-time & Ad-hoc Evaluation ─────────────────────────────────────────────

def _resolve_profile(db: Session, profile_id: Optional[str] = None, device_id: Optional[str] = None):
    profile = None
    if not db:
        return None
    try:
        if profile_id:
            profile = crud_diagnostics.get_profile(db, profile_id)
            if not profile:
                slug = profile_id.lower().replace("_", "").replace("-", "")
                all_profiles = crud_diagnostics.list_profiles(db, limit=50)
                for p in all_profiles:
                    p_slug = p.name.lower().replace("_", "").replace("-", "")
                    if p_slug in slug or slug in p_slug:
                        profile = p
                        break
        if not profile and device_id:
            sync_dev = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
            if sync_dev:
                if sync_dev.profile_id:
                    profile = crud_diagnostics.get_profile(db, sync_dev.profile_id)
                elif sync_dev.category:
                    profile = crud_diagnostics.get_profile(db, sync_dev.category)
    except Exception:
        profile = None
    return profile


def _prepare_telemetry_for_evaluation(
    telemetry_records: List[Dict[str, Any]],
    profile: Optional[Any],
) -> List[Dict[str, Any]]:
    prepared = []
    for record in telemetry_records:
        unpacked = normalize_and_unpack_record(record)
        mapped = map_record_from_profile(unpacked, profile, use_keys=True, drop_unmapped=False)
        prepared.append(mapped)
    return prepared


@router.post("/evaluate-payload", response_model=EvaluationResultResponse)
def evaluate_custom_payload(
    request: EvaluationRequest,
    db: Session = Depends(get_db),
) -> Any:
    """
    Runs diagnostic reasoning on an ad-hoc telemetry payload, automatically resolving
    device profiles, mapping raw telemetry fields, and unpacking composite fields.
    """
    device_id = request.device_id or "adhoc_device"
    telemetry = request.telemetry_window or []
    candidate_causes = get_default_candidate_causes()

    profile = _resolve_profile(db, profile_id=request.profile_id, device_id=request.device_id)
    prepared_telemetry = _prepare_telemetry_for_evaluation(telemetry, profile)

    result = evaluator.evaluate_telemetry(
        device_id=device_id,
        telemetry_records=prepared_telemetry,
        candidate_causes=candidate_causes,
        context=request.context,
        window_hours=request.window_hours,
    )
    return result


@router.post("/evaluate/{device_id}", response_model=EvaluationResultResponse)
def evaluate_device(
    device_id: str,
    request: Optional[EvaluationRequest] = None,
    save_snapshot: bool = Query(default=True, description="Whether to persist health snapshot"),
    db: Session = Depends(get_db),
) -> Any:
    """
    Runs the full diagnostic pipeline on a device and saves a health snapshot record.
    """
    req = request or EvaluationRequest()
    telemetry = req.telemetry_window or []
    candidate_causes = get_default_candidate_causes()

    profile = _resolve_profile(db, profile_id=req.profile_id, device_id=device_id)
    prepared_telemetry = _prepare_telemetry_for_evaluation(telemetry, profile)

    result = evaluator.evaluate_telemetry(
        device_id=device_id,
        telemetry_records=prepared_telemetry,
        candidate_causes=candidate_causes,
        context=req.context,
        window_hours=req.window_hours,
    )

    if save_snapshot:
        evaluator.save_snapshot(db, result)

    return result


# ── Health Snapshots & History ────────────────────────────────────────────────

@router.get("/devices/{device_id}/health", response_model=Optional[DeviceHealthSnapshotResponse])
def get_device_health(
    device_id: str,
    db: Session = Depends(get_db),
) -> Any:
    """Fetch the latest health snapshot and active diagnoses for a device."""
    snapshot = crud_diagnostics.get_latest_snapshot(db, device_id)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No health snapshot found for device '{device_id}'.",
        )
    return snapshot


@router.get("/devices/{device_id}/health/history", response_model=List[DeviceHealthSnapshotResponse])
def get_device_health_history(
    device_id: str,
    limit: int = Query(default=30, le=100),
    db: Session = Depends(get_db),
) -> Any:
    """Fetch historical health score and state transitions for a device."""
    return crud_diagnostics.get_snapshot_history(db, device_id=device_id, limit=limit)


# ── Technician Feedback Loop ──────────────────────────────────────────────────

@router.post("/feedback", response_model=DiagnosticFeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_diagnostic_feedback(
    feedback_in: DiagnosticFeedbackCreate,
    db: Session = Depends(get_db),
) -> Any:
    """Records ground truth verification from field technicians to calibrate evidential rules."""
    return crud_diagnostics.create_feedback(db, feedback_in)
