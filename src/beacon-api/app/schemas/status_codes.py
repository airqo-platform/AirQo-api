from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DecodeRule = Literal["bitmask", "exact"]
StatusCodeKind = Literal["ok", "fault", "info"]
DecodedStatus = Literal["ok", "info", "unknown", "fault", "invalid"]


class StatusCodeIn(BaseModel):
    code: int = Field(ge=0)
    label: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    kind: StatusCodeKind = "fault"


class StatusCodeOut(StatusCodeIn):
    model_config = ConfigDict(from_attributes=True)


class StatusCodeSetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    decode_rule: DecodeRule = "bitmask"
    codes: List[StatusCodeIn] = []


class StatusCodeSetUpdate(BaseModel):
    """Fields left out are kept. ``codes``, when given, replaces the whole list."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    decode_rule: Optional[DecodeRule] = None
    codes: Optional[List[StatusCodeIn]] = None


class StatusCodeSetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    decode_rule: DecodeRule
    codes: List[StatusCodeOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class StatusDecodeResult(BaseModel):
    value: Optional[float] = None
    status: DecodedStatus
    codes: List[StatusCodeOut] = []
    unknown_codes: List[int] = []


class StatusDecodeResponse(BaseModel):
    code_set: str
    decode_rule: DecodeRule
    results: List[StatusDecodeResult]
