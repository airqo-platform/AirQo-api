import json
import math
from datetime import datetime
from decimal import Decimal
from fastapi import Response

def convert_to_json_serializable(item):
    if isinstance(item, dict):
        return {k: convert_to_json_serializable(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [convert_to_json_serializable(i) for i in item]
    elif isinstance(item, datetime):
        return item.isoformat()
    elif isinstance(item, Decimal):
        try:
            # Try to convert to float first
            float_val = float(item)
            # Check for NaN, Infinity, -Infinity
            if math.isnan(float_val) or math.isinf(float_val):
                return str(float_val)
            return float_val
        except (ValueError, OverflowError, TypeError):
            # If conversion to float fails, return as string
            return str(item)
    elif isinstance(item, float):
        # Handle NaN, Infinity, -Infinity for float values
        if math.isnan(item) or math.isinf(item):
            return str(item)
        return item
    # Handle string 'NaN' values
    elif isinstance(item, str) and item.lower() == 'nan':
        return None
    return item

def create_json_response(content):
    """Create a Response with properly encoded JSON content"""
    json_content = json.dumps(content, cls=CustomJSONEncoder)
    return Response(content=json_content, media_type="application/json")

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Convert Decimal to float
            try:
                return float(obj)
            except:
                return str(obj)  # Fallback to string if float conversion fails
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)