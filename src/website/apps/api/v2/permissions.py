"""
Permission classes for v2 API - All endpoints are open

Authorization is handled at the nginx server level, so all API endpoints
are completely open without any Django-level permission checks.
"""
from rest_framework.permissions import AllowAny


# All v2 API endpoints are completely open
# Authorization is handled at nginx level
class OpenAPIPermission(AllowAny):
    """
    Completely open permission for all v2 API endpoints.
    Allows all operations (GET, POST, PUT, PATCH, DELETE) for all users.
    Authorization is handled at the nginx server level.
    """
    pass


# Backward compatibility aliases
DefaultAPIPermission = OpenAPIPermission
ReadOnlyOrAuthenticated = OpenAPIPermission
IsAuthenticatedOrReadOnlyPermission = OpenAPIPermission
APIKeyPermission = OpenAPIPermission
