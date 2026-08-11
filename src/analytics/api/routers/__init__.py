"""
FastAPI Routers for AirQo Analytics API

This package contains the FastAPI routers that replace the Flask-RESTX resources.
Each router handles a specific version of the API.
"""

from .v2 import router as v2_router
from .v3 import router as v3_router

__all__ = ["v2_router", "v3_router"]
