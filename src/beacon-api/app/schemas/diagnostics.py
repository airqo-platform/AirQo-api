import json
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.schemas.device_schema import DeviceProfileUpdateSchema, DeviceProfileUpdate


class DiagnosticHypothesisRuleBase(BaseModel):
    evidence_code: str
    weight: float
    is_mandatory: bool = False
    description: Optional[str] = None


class DiagnosticHypothesisRuleCreate(DiagnosticHypothesisRuleBase):
    pass


class DiagnosticHypothesisRuleResponse(DiagnosticHypothesisRuleBase):
    id: UUID
    cause_id: UUID

    model_config = ConfigDict(from_attributes=True)


class CauseDefinitionBase(BaseModel):
    code: str
    title: str
    category: str = "HARDWARE_FAILURE"
    description: Optional[str] = None
    recommended_action: str


class CauseDefinitionCreate(CauseDefinitionBase):
    hypothesis_rules: Optional[List[DiagnosticHypothesisRuleCreate]] = None


class CauseDefinitionResponse(CauseDefinitionBase):
    id: UUID
    template_id: UUID
    hypothesis_rules: List[DiagnosticHypothesisRuleResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SymptomDefinitionBase(BaseModel):
    code: str
    name: str
    severity: str = "MEDIUM"
    evaluation_logic: Optional[Dict[str, Any]] = None
    description: Optional[str] = None

    @field_validator("evaluation_logic", mode="before")
    @classmethod
    def parse_eval_logic(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception as e:
                raise ValueError(f"Invalid JSON in evaluation_logic: {e}")
        return v


class SymptomDefinitionCreate(SymptomDefinitionBase):
    pass


class SymptomDefinitionResponse(SymptomDefinitionBase):
    id: UUID
    template_id: UUID

    model_config = ConfigDict(from_attributes=True)


class DiagnosticTemplateBase(BaseModel):
    name: str
    target_component_type: str
    description: Optional[str] = None
    version: str = "1.0.0"


class DiagnosticTemplateCreate(DiagnosticTemplateBase):
    symptoms: Optional[List[SymptomDefinitionCreate]] = None
    causes: Optional[List[CauseDefinitionCreate]] = None


class DiagnosticTemplateResponse(DiagnosticTemplateBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    symptoms: List[SymptomDefinitionResponse] = []
    causes: List[CauseDefinitionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class EvidenceFactSchema(BaseModel):
    code: str
    check: Optional[str] = None
    component_name: str
    component_type: Optional[str] = None
    metric: Optional[str] = None
    title: Optional[str] = None
    description: str
    severity: Optional[str] = None
    confidence: float
    value: Any
    related_components: List[str] = []


class EvidenceContributionSchema(BaseModel):
    evidence: str
    contribution: float


class DiagnosisResultSchema(BaseModel):
    cause_code: str
    title: str
    component_name: Optional[str] = None
    affected_components: List[str] = []
    confidence_percentage: float
    supporting_evidence: List[EvidenceContributionSchema] = []
    refuting_evidence: List[EvidenceContributionSchema] = []
    recommended_action: str


class DataCompletenessSchema(BaseModel):
    records: int
    expected_records: Optional[int] = None
    missing_rate: Optional[float] = None
    expected_interval_seconds: Optional[float] = None


class EvaluationRequest(BaseModel):
    device_id: Optional[str] = None
    profile_id: Optional[str] = None                        # Device profile ID or name; defaults to the device's profile
    telemetry_window: Optional[List[Dict[str, Any]]] = None # Optional custom telemetry records
    context: Optional[Dict[str, Any]] = None                # expected_interval_seconds, policy overrides
    window_hours: float = 24.0


class EvaluationResultResponse(BaseModel):
    device_id: str
    profile_id: Optional[str] = None
    profile_name: Optional[str] = None
    overall_health_score: float
    lifecycle_state: str
    subsystem_scores: Dict[str, float]                      # Keyed by profile component name
    active_evidences: List[EvidenceFactSchema]
    detected_symptoms: List[str]
    top_diagnoses: List[DiagnosisResultSchema]
    data_completeness: Optional[DataCompletenessSchema] = None
    profile_warnings: List[str] = []
    evaluated_window_hours: float
    timestamp: datetime


class ProfileDiagnosticReadinessResponse(BaseModel):
    profile_id: Optional[str] = None
    profile_name: Optional[str] = None
    diagnosable: bool
    errors: List[str] = []
    warnings: List[str] = []
    evaluated_metrics: List[str] = []
    transmission_components: List[str] = []
    dependencies: Dict[str, List[str]] = {}
    redundant_pairs: List[str] = []
    effective_policy: Dict[str, Any] = {}


class DeviceHealthSnapshotResponse(BaseModel):
    id: UUID
    device_id: str
    timestamp: datetime
    overall_health_score: float
    lifecycle_state: str
    subsystem_scores: Dict[str, float] = {}
    active_evidences: Optional[List[Dict[str, Any]]] = None
    detected_symptoms: Optional[List[str]] = None
    top_diagnoses: Optional[List[Dict[str, Any]]] = None
    evaluated_window_hours: float

    @field_validator("subsystem_scores", "active_evidences", "detected_symptoms", "top_diagnoses", mode="before")
    @classmethod
    def parse_json_fields(cls, v: Any) -> Any:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return None
        return v

    model_config = ConfigDict(from_attributes=True)


class DiagnosticFeedbackCreate(BaseModel):
    snapshot_id: Optional[UUID] = None
    device_id: str
    technician_user_id: str
    confirmed_cause_code: str
    was_prediction_accurate: bool
    actions_taken: Optional[str] = None
    technician_notes: Optional[str] = None


class DiagnosticFeedbackResponse(DiagnosticFeedbackCreate):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Daily Diagnostics ─────────────────────────────────────────────────────────

class DailyIssueResponse(BaseModel):
    issue_code: str
    check_type: str
    component_name: Optional[str] = None
    metric_key: Optional[str] = None
    title: str
    subsystem: str
    severity: str
    confidence: Optional[float] = None
    description: Optional[str] = None
    value: Optional[Any] = None
    is_new: bool
    streak_days: int
    streak_start_date: date

    model_config = ConfigDict(from_attributes=True)


class FleetIssueResponse(DailyIssueResponse):
    device_id: str
    diagnosis_date: date


class DeviceDailyDiagnosticSummaryResponse(BaseModel):
    id: UUID
    device_id: str
    channel_id: Optional[str] = None
    diagnosis_date: date
    record_count: int
    hours_with_data: int
    overall_health_score: float
    lifecycle_state: str
    subsystem_scores: Dict[str, float] = {}
    top_cause_code: Optional[str] = None
    issue_count: int
    max_severity: Optional[str] = None
    resolved_issue_codes: Optional[List[str]] = None
    engine_version: Optional[str] = None
    evaluated_at: Optional[datetime] = None
    issues: List[DailyIssueResponse] = []

    model_config = ConfigDict(from_attributes=True)


class DeviceDailyDiagnosticResponse(DeviceDailyDiagnosticSummaryResponse):
    profile_id: Optional[UUID] = None
    first_record_at: Optional[datetime] = None
    last_record_at: Optional[datetime] = None
    active_evidences: Optional[List[Dict[str, Any]]] = None
    detected_symptoms: Optional[List[str]] = None
    top_diagnoses: Optional[List[Dict[str, Any]]] = None
    metrics_summary: Optional[Dict[str, Dict[str, float]]] = None


class DeviceIssueHistoryItem(BaseModel):
    issue_code: str
    title: str
    subsystem: str
    severity: str
    days_observed: int
    first_seen: date
    last_seen: date
    is_active: bool
    current_streak_days: int


class HealthTrendPoint(BaseModel):
    diagnosis_date: date
    overall_health_score: float
    lifecycle_state: str
    issue_count: int


class DeviceIssueSummaryResponse(BaseModel):
    device_id: str
    start_date: date
    end_date: date
    days_diagnosed: int
    average_health_score: Optional[float] = None
    latest_diagnosis_date: Optional[date] = None
    latest_lifecycle_state: Optional[str] = None
    issues: List[DeviceIssueHistoryItem] = []
    health_trend: List[HealthTrendPoint] = []


class FleetTopIssue(BaseModel):
    issue_code: str
    check_type: str
    component_name: Optional[str] = None
    title: str
    subsystem: str
    severity: str
    device_count: int
    new_device_count: int


class FleetDeviceHealth(BaseModel):
    device_id: str
    overall_health_score: float
    lifecycle_state: str
    issue_count: int
    max_severity: Optional[str] = None
    top_cause_code: Optional[str] = None


class FleetDailySummaryResponse(BaseModel):
    diagnosis_date: Optional[date] = None
    devices_diagnosed: int
    devices_with_issues: int
    average_health_score: Optional[float] = None
    lifecycle_state_counts: Dict[str, int] = {}
    max_severity_counts: Dict[str, int] = {}
    new_issue_count: int
    resolved_issue_count: int
    top_issues: List[FleetTopIssue] = []
    worst_devices: List[FleetDeviceHealth] = []


class DailyDiagnosticsRunResponse(BaseModel):
    success: bool
    message: str
    start_date: date
    end_date: date
    device_ids: Optional[List[str]] = None
    force: bool
