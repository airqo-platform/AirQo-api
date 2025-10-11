"""
v2 API URL Configuration

Single DefaultRouter registering all 13 app resources for the v2 API.
URL pattern: /website/api/v2/<resource>/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .viewsets.africancities import AfricanCountryViewSet
from .viewsets.board import BoardMemberViewSet
from .viewsets.career import CareerViewSet, DepartmentViewSet
from .viewsets.cleanair import CleanAirResourceViewSet, ForumEventViewSet
from .viewsets.event import EventViewSet, InquiryViewSet, ProgramViewSet, SessionViewSet, PartnerLogoViewSet, ResourceViewSet
from .viewsets.externalteams import ExternalTeamMemberViewSet, ExternalTeamMemberBiographyViewSet
from .viewsets.faqs import FAQViewSet
from .viewsets.highlights import HighlightViewSet, TagViewSet
from .viewsets.impact import ImpactNumberViewSet
from .viewsets.partners import PartnerViewSet, PartnerDescriptionViewSet
from .viewsets.press import PressViewSet
from .viewsets.publications import PublicationViewSet
from .viewsets.team import MemberViewSet, MemberBiographyViewSet

# Create the main router for v2 API
router = DefaultRouter()

# Register all 13 app resources
router.register(r'african-countries', AfricanCountryViewSet,
                basename='v2-african-countries')
router.register(r'board-members', BoardMemberViewSet,
                basename='v2-board-members')
router.register(r'careers', CareerViewSet, basename='v2-careers')
router.register(r'departments', DepartmentViewSet, basename='v2-departments')
router.register(r'clean-air-resources', CleanAirResourceViewSet,
                basename='v2-clean-air-resources')
router.register(r'forum-events', ForumEventViewSet, basename='v2-forum-events')
router.register(r'events', EventViewSet, basename='v2-events')
router.register(r'event-inquiries', InquiryViewSet,
                basename='v2-event-inquiries')
router.register(r'event-programs', ProgramViewSet,
                basename='v2-event-programs')
router.register(r'event-sessions', SessionViewSet,
                basename='v2-event-sessions')
router.register(r'event-partner-logos', PartnerLogoViewSet,
                basename='v2-event-partner-logos')
router.register(r'event-resources', ResourceViewSet,
                basename='v2-event-resources')
router.register(r'external-team-members', ExternalTeamMemberViewSet,
                basename='v2-external-team-members')
router.register(r'external-team-biographies', ExternalTeamMemberBiographyViewSet,
                basename='v2-external-team-biographies')
router.register(r'faqs', FAQViewSet, basename='v2-faqs')
router.register(r'highlights', HighlightViewSet, basename='v2-highlights')
router.register(r'tags', TagViewSet, basename='v2-tags')
router.register(r'impact-numbers', ImpactNumberViewSet,
                basename='v2-impact-numbers')
router.register(r'partners', PartnerViewSet, basename='v2-partners')
router.register(r'partner-descriptions', PartnerDescriptionViewSet,
                basename='v2-partner-descriptions')
router.register(r'press', PressViewSet, basename='v2-press')
router.register(r'publications', PublicationViewSet,
                basename='v2-publications')
router.register(r'team-members', MemberViewSet, basename='v2-team-members')
router.register(r'team-biographies', MemberBiographyViewSet,
                basename='v2-team-biographies')

urlpatterns = [
    path('', include(router.urls)),
]
