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
from typing import Optional, Any
from django.db.models.query import QuerySet
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.event.models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from ..filters.event import EventFilter, InquiryFilter, ProgramFilter, SessionFilter, PartnerLogoFilter, ResourceFilter
from ..pagination import StandardPageNumberPagination, StandardCursorPagination
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
    # All endpoints are open - authorization handled at nginx level
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
    slug_filter_fields = ('slug',)  # Event uses standard slug field
    select_related_fields = []  # No foreign keys to optimize
    prefetch_related_fields = ['sessions',
                               'programs', 'resources', 'partner_logos']
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

    def get_queryset(self) -> Any:  # type: ignore[override]
        """Optimized queryset with aggressive performance improvements"""
        from django.core.cache import cache
        from django.db import connection

        # Base queryset with efficient ordering
        qs = Event.objects.all()

        # Get action and optimize accordingly
        action = getattr(self, 'action', None)

        # Check if we need complete data (detail view) or minimal data (list view)
        if action == 'retrieve':
            # For detail view - prefetch ALL related data
            qs = qs.prefetch_related(
                'inquiries',
                'programs__sessions',  # Nested prefetch for programs and their sessions
                'partner_logos',
                'resources'
            ).select_related()  # No foreign keys to select, but good practice

        elif action == 'list':
            # For list view - minimal data with only() to reduce fields fetched
            list_fields = [
                'id', 'slug', 'title', 'title_subtext', 'start_date', 'end_date',
                'start_time', 'end_time', 'event_tag', 'event_category',
                'website_category', 'event_image', 'location_name', 'location_link',
                'registration_link', 'order', 'created', 'modified'
            ]
            qs = qs.only(*list_fields)
        else:
            # For other actions (upcoming, past, calendar) - prefetch minimal related data
            qs = qs.prefetch_related(
                'inquiries', 'programs', 'partner_logos', 'resources')

        # Apply efficient ordering based on common queries
        if action in ['past']:
            qs = qs.order_by('-end_date', 'order')
        elif action in ['upcoming']:
            qs = qs.order_by('start_date', 'order')
        else:
            qs = qs.order_by('-start_date', 'order')

        # Filter out soft-deleted items
        if hasattr(Event, 'is_deleted'):
            qs = qs.filter(is_deleted=False)

        logger.debug(
            f"EventViewSet.get_queryset: optimized for action={action}")
        return qs

    def list(self, request, *args, **kwargs):
        """Override list to add caching and measure timing"""
        import time
        from django.core.cache import cache
        from django.utils.encoding import force_str

        t0 = time.time()

        # Generate cache key based on query parameters
        query_params = request.query_params.copy()
        cache_key = f"events_list_{hash(frozenset(query_params.items()))}"

        # Try to get from cache first
        cached_response = cache.get(cache_key)
        if cached_response:
            logger.info(
                f"EventViewSet.list: returned cached response in {time.time() - t0:.3f}s")
            return Response(cached_response)

        queryset = self.filter_queryset(self.get_queryset())

        try:
            count = queryset.count()
        except Exception:
            count = 'unknown'
        logger.info("EventViewSet.list: queryset prepared count=%s", count)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            paginated_response = self.get_paginated_response(serializer.data)

            # Cache the response for 5 minutes
            cache.set(cache_key, paginated_response.data, 300)

            logger.info(
                f"EventViewSet.list: paginated response prepared in {time.time() - t0:.3f}s")
            return paginated_response

        serializer = self.get_serializer(queryset, many=True)
        response_data = serializer.data

        # Cache the response for 5 minutes
        cache.set(cache_key, response_data, 300)

        logger.info(
            f"EventViewSet.list: full response prepared in {time.time() - t0:.3f}s")
        return Response(response_data)

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to add caching for individual events"""
        from django.core.cache import cache
        import time

        t0 = time.time()

        # Get the lookup value (slug or ID)
        lookup_value = kwargs.get(self.lookup_field, kwargs.get('pk'))
        cache_key = f"event_detail_{lookup_value}"

        # Try to get from cache first
        cached_response = cache.get(cache_key)
        if cached_response:
            logger.info(
                f"EventViewSet.retrieve: returned cached response in {time.time() - t0:.3f}s")
            return Response(cached_response)

        instance = self.get_object()
        serializer = self.get_serializer(instance)
        response_data = serializer.data

        # Cache the response for 10 minutes (longer for detail views)
        cache.set(cache_key, response_data, 600)

        logger.info(
            f"EventViewSet.retrieve: response prepared in {time.time() - t0:.3f}s")
        return Response(response_data)

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
        from django.db.models import Q
        # past if end_date < today OR (no end_date and start_date < today)
        queryset = self.get_queryset().filter(
            Q(end_date__lt=now) | Q(end_date__isnull=True, start_date__lt=now))

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
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InquiryFilter
    search_fields = ['inquiry', 'role', 'email']
    ordering_fields = ['role', 'email', 'order']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    # Performance optimization
    select_related_fields = ['event']
    list_only_fields = ['id', 'inquiry', 'role', 'email', 'order', 'event']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return InquiryListSerializer
        return InquiryDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Inquiry, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('event').order_by('order')


class ProgramViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Program ViewSet for event programs"""
    queryset = Program.objects.all()
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProgramFilter
    search_fields = ['program_details']
    ordering_fields = ['date', 'order']
    ordering = ['date', 'order']
    pagination_class = StandardPageNumberPagination

    # Performance optimization
    select_related_fields = ['event']
    prefetch_related_fields = ['sessions']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return ProgramListSerializer
        return ProgramDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Program, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('event').prefetch_related('sessions').order_by('date', 'order')


class SessionViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Session ViewSet for event sessions"""
    queryset = Session.objects.all()
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SessionFilter
    search_fields = ['session_title', 'session_details', 'venue']
    ordering_fields = ['start_time', 'end_time', 'order']
    ordering = ['start_time', 'order']
    pagination_class = StandardPageNumberPagination

    # Performance optimization
    select_related_fields = ['program', 'program__event']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return SessionListSerializer
        return SessionDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Session, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('program', 'program__event').order_by('start_time', 'order')


class PartnerLogoViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """PartnerLogo ViewSet for event partner logos"""
    queryset = PartnerLogo.objects.all()
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PartnerLogoFilter
    search_fields = ['name']
    ordering_fields = ['name', 'order']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    # Performance optimization
    select_related_fields = ['event']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PartnerLogoListSerializer
        return PartnerLogoDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(PartnerLogo, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('event').order_by('order')


class ResourceViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Resource ViewSet for event resources"""
    queryset = Resource.objects.all()
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ResourceFilter
    search_fields = ['title', 'link']
    ordering_fields = ['title', 'order']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    # Performance optimization
    select_related_fields = ['event']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return ResourceListSerializer
        return ResourceDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Resource, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('event').order_by('order')
