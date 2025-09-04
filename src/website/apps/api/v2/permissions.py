"""
Permission classes for v2 API (scaffolding - disabled by default)

Security scaffolding that can be toggled on when needed.
Currently defaults to AllowAny to maintain open access.
"""
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
import logging

logger = logging.getLogger(__name__)


class DefaultAPIPermission(AllowAny):
    """
    Default permission class - currently allows all access.

    TODO: When security is enabled, switch to more restrictive permissions.
    """
    pass


class IsAuthenticatedOrReadOnlyPermission(IsAuthenticatedOrReadOnly):
    """
    Permission class that allows authenticated users full access,
    unauthenticated users read-only access.

    DISABLED BY DEFAULT - Toggle via settings when ready.
    """
    pass


class APIKeyPermission(AllowAny):
    """
    API Key-based permission class (disabled by default).

    TODO: Implement API key validation when security is enabled.
    """

    def has_permission(self, request, view):
        # TODO: Implement API key validation
        # api_key = request.headers.get('X-API-Key')
        # if not api_key:
        #     return False
        # return validate_api_key(api_key)
        return super().has_permission(request, view)


# Throttling classes (disabled by default)
class StandardAnonThrottle(AnonRateThrottle):
    """
    Anonymous user throttling (disabled by default).
    Rate: 100 requests per hour for anonymous users.
    """
    rate = '100/hour'


class StandardUserThrottle(UserRateThrottle):
    """
    Authenticated user throttling (disabled by default).
    Rate: 1000 requests per hour for authenticated users.
    """
    rate = '1000/hour'


# Permission class mapping for easy toggling
PERMISSION_CLASSES = {
    'default': [DefaultAPIPermission],
    'auth_required': [IsAuthenticatedOrReadOnlyPermission],
    'api_key': [APIKeyPermission],
}

THROTTLE_CLASSES = {
    'standard': [StandardAnonThrottle, StandardUserThrottle],
    'disabled': [],
}


def get_permission_classes(permission_type='default'):
    """
    Get permission classes based on configuration.

    Args:
        permission_type (str): Type of permissions to apply

    Returns:
        list: Permission classes to use
    """
    return PERMISSION_CLASSES.get(permission_type, PERMISSION_CLASSES['default'])


def get_throttle_classes(throttle_type='disabled'):
    """
    Get throttle classes based on configuration.

    Args:
        throttle_type (str): Type of throttling to apply

    Returns:
        list: Throttle classes to use
    """
    return THROTTLE_CLASSES.get(throttle_type, THROTTLE_CLASSES['disabled'])
