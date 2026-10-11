"""
Status Code Sets
────────────────
Device types report status codes in a telemetry field, and each type has its own codes. A
status code set holds one type's codes, what they mean, and the rule for reading a value:

- ``bitmask``: the value is the sum of every active code, and each code is a single bit
  (1, 2, 4, 8, ...). BAM-1020 status 17 is 16 (Flow Failure) + 1 (Tape Break). Splitting a
  value into its bits is the same as repeatedly subtracting the largest code that fits, and
  single-bit codes guarantee each value splits one way only. 0 means nothing is set.
- ``exact``: the value is one code.

A profile points a telemetry field at a set by name with ``"status_code_set"`` in its mapping.
"""
import math
from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.status_codes import StatusCode, StatusCodeSet
from app.schemas.status_codes import StatusCodeSetCreate, StatusCodeSetUpdate

BITMASK = "bitmask"
EXACT = "exact"
# A decoded value takes the most serious kind among its parts; an undefined part ranks below a fault.
_STATUS_RANK = {"ok": 0, "info": 1, "unknown": 2, "fault": 3}


class StatusCodeSetError(ValueError):
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


class StatusCodeSetNameTaken(StatusCodeSetError):
    def __init__(self, name: str):
        super().__init__([f"A status code set named '{name}' already exists."])


def validate_codes(decode_rule: str, codes: Iterable[Any]) -> List[str]:
    """Return what is wrong with ``codes`` under ``decode_rule``; empty when valid."""
    errors: List[str] = []
    seen = set()
    for c in codes:
        if c.code in seen:
            errors.append(f"Code {c.code} is listed more than once.")
        seen.add(c.code)
        if decode_rule != BITMASK:
            continue
        if c.code & (c.code - 1):
            errors.append(
                f"Code {c.code} is not a single bit (1, 2, 4, 8, ...). With the bitmask rule a value is the sum "
                f"of its codes, so each code must be its own bit for a value like 17 to decode one way only."
            )
        if c.code == 0 and c.kind != "ok":
            errors.append("Code 0 means no status is set, so with the bitmask rule its kind must be 'ok'.")
        if c.code and c.kind == "ok":
            errors.append(f"Code {c.code} has kind 'ok'; with the bitmask rule only code 0 can be 'ok'.")
    return errors


def _as_number(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _code_dict(c: Any) -> Dict[str, Any]:
    return {"code": c.code, "label": c.label, "description": c.description, "kind": c.kind}


def decode_value(decode_rule: str, codes: Iterable[Any], value: Any) -> Dict[str, Any]:
    """
    Translate one reported value into its codes. The value must be a non-negative whole number
    (``17``, ``17.0`` or ``"17"``), otherwise the result is ``invalid``. Parts of the value with
    no defined code are listed in ``unknown_codes``.
    """
    number = _as_number(value)
    if number is None or number < 0 or abs(number - round(number)) > 1e-6:
        return {"value": number, "status": "invalid", "codes": [], "unknown_codes": []}

    whole = int(round(number))
    by_code = {c.code: c for c in codes}
    if decode_rule == BITMASK and whole == 0:
        parts, unknown = ([by_code[0]] if 0 in by_code else []), []
    else:
        wanted = [1 << i for i in range(whole.bit_length()) if whole >> i & 1] if decode_rule == BITMASK else [whole]
        parts = [by_code[c] for c in wanted if c in by_code]
        unknown = [c for c in wanted if c not in by_code]

    kinds = [p.kind for p in parts] + (["unknown"] if unknown else [])
    return {
        "value": number,
        "status": max(kinds, key=lambda k: _STATUS_RANK.get(k, 0)) if kinds else "ok",
        "codes": [_code_dict(p) for p in parts],
        "unknown_codes": unknown,
    }


def decode_values(code_set: StatusCodeSet, values: Iterable[Any]) -> List[Dict[str, Any]]:
    return [decode_value(code_set.decode_rule, code_set.codes, v) for v in values]


# ── Persistence ───────────────────────────────────────────────────────────────

def get_code_set(db: Session, ref: str) -> Optional[StatusCodeSet]:
    """Look a set up by ID or name."""
    try:
        found = db.query(StatusCodeSet).filter(StatusCodeSet.id == UUID(str(ref))).first()
        if found:
            return found
    except ValueError:
        pass
    return db.query(StatusCodeSet).filter(StatusCodeSet.name == ref).first()


def list_code_sets(db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None) -> List[StatusCodeSet]:
    q = db.query(StatusCodeSet)
    if search:
        q = q.filter(StatusCodeSet.name.ilike(f"%{search}%"))
    return q.order_by(StatusCodeSet.name).offset(skip).limit(limit).all()


def _name_taken(db: Session, name: str, exclude_id: Optional[UUID] = None) -> bool:
    q = db.query(StatusCodeSet.id).filter(StatusCodeSet.name == name)
    if exclude_id is not None:
        q = q.filter(StatusCodeSet.id != exclude_id)
    return q.first() is not None


def create_code_set(db: Session, data: StatusCodeSetCreate) -> StatusCodeSet:
    errors = validate_codes(data.decode_rule, data.codes)
    if errors:
        raise StatusCodeSetError(errors)
    if _name_taken(db, data.name):
        raise StatusCodeSetNameTaken(data.name)
    code_set = StatusCodeSet(
        name=data.name,
        description=data.description,
        decode_rule=data.decode_rule,
        codes=[StatusCode(**c.model_dump()) for c in data.codes],
    )
    db.add(code_set)
    db.commit()
    db.refresh(code_set)
    return code_set


def update_code_set(db: Session, code_set: StatusCodeSet, data: StatusCodeSetUpdate) -> StatusCodeSet:
    decode_rule = data.decode_rule or code_set.decode_rule
    codes = data.codes if data.codes is not None else code_set.codes
    errors = validate_codes(decode_rule, codes)
    if errors:
        raise StatusCodeSetError(errors)
    if data.name and _name_taken(db, data.name, exclude_id=code_set.id):
        raise StatusCodeSetNameTaken(data.name)

    if data.name:
        code_set.name = data.name
    if "description" in data.model_fields_set:
        code_set.description = data.description
    code_set.decode_rule = decode_rule
    if data.codes is not None:
        # Remove the old rows first so re-adding the same code doesn't hit the unique constraint.
        code_set.codes.clear()
        db.flush()
        code_set.codes.extend(StatusCode(**c.model_dump()) for c in data.codes)
    db.commit()
    db.refresh(code_set)
    return code_set


def delete_code_set(db: Session, code_set: StatusCodeSet) -> None:
    db.delete(code_set)
    db.commit()
