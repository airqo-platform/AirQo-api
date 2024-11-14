# externalTeam/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ExternalTeamMemberViewSet

# Initialize the router
router = DefaultRouter()

# Register the ExternalTeamMemberViewSet
router.register(r'external-team-members',
                ExternalTeamMemberViewSet, basename='external-team-member')

urlpatterns = [
    path('', include(router.urls)),
]
