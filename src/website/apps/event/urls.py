# backend/apps/event/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet,
    InquiryViewSet,
    ProgramViewSet,
    SessionViewSet,
    PartnerLogoViewSet,
    ResourceViewSet,
)

router = DefaultRouter()
router.register(r'events', EventViewSet, basename='event')
router.register(r'inquiries', InquiryViewSet, basename='inquiry')
router.register(r'programs', ProgramViewSet, basename='program')
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'partner-logos', PartnerLogoViewSet, basename='partnerlogo')
router.register(r'resources', ResourceViewSet, basename='resource')

urlpatterns = [
    path('', include(router.urls)),
]
