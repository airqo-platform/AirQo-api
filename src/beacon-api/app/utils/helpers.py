import json
from decimal import Decimal
from datetime import datetime, date
from typing import Any
from fastapi.responses import JSONResponse


def convert_to_json_serializable(obj: Any) -> Any:
    """
    Convert complex types to JSON serializable format
    """
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    return obj


def create_json_response(data: Any, status_code: int = 200) -> JSONResponse:
    """
    Create a JSON response with proper serialization
    """
    serializable_data = convert_to_json_serializable(data)
    return JSONResponse(content=serializable_data, status_code=status_code)