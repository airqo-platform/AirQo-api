"""
Event app viewsets for v2 API

Special features for event app as per requirements:
- Date hierarchy
- Upcoming/past event filters
- Virtual vs venue fields
- Registration counts
- Calendar-friendly fields
- Universal slug support for privacy-friendly URLs
"""
from django.utils import timezone
from typing import Optional
from django.db.models.query import QuerySet
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.event.models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from ..filters.event import EventFilter, InquiryFilter, ProgramFilter, SessionFilter, PartnerLogoFilter, ResourceFilter
from ..pagination import StandardPageNumberPagination, StandardCursorPagination
from ..permissions import DefaultAPIPermission
from ..mixins import SlugModelViewSetMixin, OptimizedQuerySetMixin
from ..serializers.event import (
    EventListSerializer, EventDetailSerializer,
    InquiryListSerializer, InquiryDetailSerializer,
    ProgramListSerializer, ProgramDetailSerializer,
    SessionListSerializer, SessionDetailSerializer,
    PartnerLogoListSerializer, PartnerLogoDetailSerializer,
    ResourceListSerializer, ResourceDetailSerializer
)
from ..utils import OptimizedQuerySetMixin
import logging
from django.db import connection

logger = logging.getLogger(__name__)


class EventViewSet(SlugModelViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    Event ViewSet with universal slug support and special date hierarchy

    Special features:
    - Privacy-friendly slug URLs (e.g., /events/clean-air-summit-2025/)
    - Automatic ID hiding when slugs exist
    - Backward compatibility with ID-based URLs
    - Date hierarchy and event status filtering

    Special actions:
    - upcoming/ - Get upcoming events
    - past/ - Get past events  
    - calendar/ - Get events in calendar format
    - by-slug/<slug>/ - Explicit slug lookup
    - <slug|id>/identifiers/ - Get all identifiers for an event
    """
    queryset = Event.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = EventFilter
    search_fields = ['title', 'title_subtext', 'location_name']
    ordering_fields = ['start_date', 'end_date',
                       'title', 'order', 'created', 'modified']
    ordering = ['-start_date', 'order']
    
    # Slug configuration
    slug_filter_fields = ['slug']  # Event uses standard slug field
    select_related_fields = []  # No foreign keys to optimize
    prefetch_related_fields = ['sessions', 'programs', 'resources', 'partner_logos']
    pagination_class = StandardPageNumberPagination
    # Limit fields retrieved for list action to speed up list serialization
    list_only_fields = [
        'id', 'title', 'title_subtext', 'start_date', 'end_date',
        'start_time', 'end_time', 'event_tag', 'location_name',
        'registration_link', 'order', 'created', 'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return EventListSerializer
        return EventDetailSerializer

    def get_queryset(self) -> QuerySet[Event]:  # type: ignore[override]
        """Optimized queryset with performance improvements"""
        # Base queryset with efficient ordering
        qs = Event.objects.all()

        # Apply select_related for ForeignKey/OneToOne relations to reduce queries
        select_related_fields = []
        for field in Event._meta.get_fields():
            if hasattr(field, 'related_model') and field.many_to_one:
                if hasattr(Event, field.name):
                    select_related_fields.append(field.name)

        if select_related_fields:
            qs = qs.select_related(*select_related_fields)

        # Apply prefetch_related for commonly used reverse relations
        prefetch_fields = ['inquiries', 'programs',
                           'partner_logos', 'resources']
        # Filter to only existing relations
        existing_prefetch = []
        for field_name in prefetch_fields:
            try:
                # Test if the relation exists by accessing the related manager
                getattr(Event, field_name, None)
                existing_prefetch.append(field_name)
            except:
                continue

        if existing_prefetch:
            qs = qs.prefetch_related(*existing_prefetch)

        # For list view, use only() to fetch minimal fields for better performance
        if getattr(self, 'action', None) == 'list':
            if self.list_only_fields:
                qs = qs.only(*self.list_only_fields)

        # Apply efficient ordering
        qs = qs.order_by('-start_date', 'order')

        logger.debug(
            f"EventViewSet.get_queryset: optimized with select_related={select_related_fields}, prefetch_related={existing_prefetch}")
        return qs

    def list(self, request, *args, **kwargs):
        """Override list to measure and log timing to help diagnose timeouts."""
        import time

        t0 = time.time()
        queryset = self.filter_queryset(self.get_queryset())
        try:
            count = queryset.count()
        except Exception:
            count = 'unknown'
        logger.info("EventViewSet.list: queryset prepared count=%s", count)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            resp = self.get_paginated_response(serializer.data)
            logger.info(
                "EventViewSet.list: paginated response prepared in %.3fs", time.time() - t0)
            return resp

        serializer = self.get_serializer(queryset, many=True)
        logger.info(
            "EventViewSet.list: full response prepared in %.3fs", time.time() - t0)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events"""
        now = timezone.now().date()
        queryset = self.get_queryset().filter(start_date__gt=now)

        # Apply filters and pagination
        queryset = self.filter_queryset(queryset)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        """Get past events"""
        now = timezone.now().date()
        queryset = self.get_queryset().filter(end_date__lt=now)

        # Apply filters and pagination
        queryset = self.filter_queryset(queryset)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Get events in calendar format with date hierarchy"""
        queryset = self.get_queryset()

        # Get year/month from query params for date hierarchy
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        if year:
            queryset = queryset.filter(start_date__year=year)
        if month:
            queryset = queryset.filter(start_date__month=month)

        # Apply other filters
        queryset = self.filter_queryset(queryset)

        # Group by date for calendar view
        events_by_date = {}
        for event in queryset:
            date_key = event.start_date.strftime('%Y-%m-%d')
            if date_key not in events_by_date:
                events_by_date[date_key] = []

            serializer = self.get_serializer(event)
            events_by_date[date_key].append(serializer.data)

        return Response({
            'calendar': events_by_date,
            'total_events': queryset.count(),
            'year': year,
            'month': month
        })


class InquiryViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Inquiry ViewSet for event-related inquiries"""
    queryset = Inquiry.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InquiryFilter
    search_fields = ['inquiry', 'role', 'email']
    ordering_fields = ['role', 'email', 'order']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return InquiryListSerializer
        return InquiryDetailSerializer


class ProgramViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Program ViewSet for event programs"""
    queryset = Program.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProgramFilter
    search_fields = ['program_details']
    ordering_fields = ['date', 'order']
    ordering = ['date', 'order']
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return ProgramListSerializer
        return ProgramDetailSerializer


class SessionViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Session ViewSet for event sessions"""
    queryset = Session.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SessionFilter
    search_fields = ['session_title', 'venue']
    ordering_fields = ['start_time', 'end_time', 'session_title', 'order']
    ordering = ['start_time', 'order']
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return SessionListSerializer
        return SessionDetailSerializer


class PartnerLogoViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """PartnerLogo ViewSet for event partner logos"""
    queryset = PartnerLogo.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PartnerLogoFilter
    search_fields = ['name']
    ordering_fields = ['name', 'order']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PartnerLogoListSerializer
        return PartnerLogoDetailSerializer


class ResourceViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Resource ViewSet for event resources"""
    queryset = Resource.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ResourceFilter
    search_fields = ['title']
    ordering_fields = ['title', 'order']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return ResourceListSerializer
        return ResourceDetailSerializer
