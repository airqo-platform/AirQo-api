import json
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
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
            except Exception:
                return {}
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
    component_name: str
    description: str
    confidence: float
    value: Any


class EvidenceContributionSchema(BaseModel):
    evidence: str
    contribution: float


class DiagnosisResultSchema(BaseModel):
    cause_code: str
    title: str
    confidence_percentage: float
    supporting_evidence: List[EvidenceContributionSchema] = []
    refuting_evidence: List[EvidenceContributionSchema] = []
    recommended_action: str


class EvaluationRequest(BaseModel):
    device_id: Optional[str] = None
    profile_id: Optional[str] = None                        # Optional device profile ID or name
    telemetry_window: Optional[List[Dict[str, Any]]] = None # Optional custom telemetry records
    context: Optional[Dict[str, Any]] = None                # Weather, ambient irradiance, ambient temp
    window_hours: float = 24.0


class EvaluationResultResponse(BaseModel):
    device_id: str
    overall_health_score: float
    lifecycle_state: str
    subsystem_scores: Dict[str, float]
    active_evidences: List[EvidenceFactSchema]
    detected_symptoms: List[str]
    top_diagnoses: List[DiagnosisResultSchema]
    evaluated_window_hours: float
    timestamp: datetime


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
