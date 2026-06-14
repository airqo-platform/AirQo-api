"""
Event app viewsets for v2 API

Special features for event app as per requirements:
- Date hierarchy
- Upcoming/past event filters
- Virtual vs venue fields
- Registration counts
- Calendar-friendly fields
- Universal slug support for privacy-friendly URLs
- Organizers and side-event relationships
"""
from django.utils import timezone
from typing import Optional, Any, ClassVar, List
from django.db.models import Case, When, Value, Count, Q, IntegerField
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.event.models import (
    Event, Inquiry, Program, Session, PartnerLogo, Resource,
    Organizer, EventOrganizer, EventSideEvent,
    Partner, EventPartner,
)
from ..filters.event import (
    EventFilter, InquiryFilter, ProgramFilter, SessionFilter,
    PartnerLogoFilter, ResourceFilter,
)
from ..pagination import StandardPageNumberPagination
from ..mixins import SlugModelViewSetMixin, OptimizedQuerySetMixin
from ..serializers.event import (
    EventListSerializer, EventDetailSerializer,
    InquiryListSerializer, InquiryDetailSerializer,
    ProgramListSerializer, ProgramDetailSerializer,
    SessionListSerializer, SessionDetailSerializer,
    PartnerLogoListSerializer, PartnerLogoDetailSerializer,
    ResourceListSerializer, ResourceDetailSerializer,
    OrganizerSerializer, EventOrganizerLinkSerializer,
    PartnerSerializer, EventPartnerLinkSerializer,
)
from ..utils import CachedViewSetMixin
import logging

logger = logging.getLogger(__name__)


class EventViewSet(SlugModelViewSetMixin, CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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
    search_fields: ClassVar[List[str]] = [
        'title', 'title_subtext', 'location_name']
    ordering_fields: ClassVar[List[str]] = [
        'start_date', 'end_date', 'start_time', 'end_time',
        'title', 'order', 'created', 'modified',
    ]
    # Default ordering: set to [] so OrderingFilter doesn't override
    # our custom date-based ordering in get_queryset.
    ordering: ClassVar[List[str]] = []

    # Slug configuration
    slug_filter_fields = ('slug',)  # Event uses standard slug field
    # No foreign keys to optimize
    select_related_fields: Optional[List[str]] = []
    # Remove invalid 'sessions' - sessions are related through programs, not directly to events
    prefetch_related_fields: Optional[List[str]] = [
        'inquiries', 'programs', 'resources', 'partner_logos',
        'event_organizer_links__organizer',
        'event_partner_links__partner',
        'side_event_links__side_event',
        'parent_event_links__parent_event',
    ]
    pagination_class = StandardPageNumberPagination
    # Limit fields retrieved for list action to speed up list serialization
    list_only_fields: Optional[List[str]] = [
        'id', 'title', 'title_subtext', 'start_date', 'end_date',
        'start_time', 'end_time', 'event_tag', 'location_name',
        'registration_link', 'order', 'created', 'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in {'list', 'featured', 'upcoming', 'past', 'calendar'}:
            return EventListSerializer
        return EventDetailSerializer

    def get_queryset(self) -> Any:  # type: ignore[override]
        """Optimized queryset with aggressive performance improvements"""
        # Base queryset with efficient ordering (retain mixin hooks)
        qs = super().get_queryset()

        # Get action and optimize accordingly
        action = getattr(self, 'action', None)

        # Check if we need complete data (detail view) or minimal data (list view)
        if action == 'retrieve':
            # For detail view - prefetch ALL related data including the
            # new organizer, partner, and side-event links.
            qs = qs.prefetch_related(
                'inquiries',
                'programs__sessions',  # Nested prefetch for programs and their sessions
                'partner_logos',
                'resources',
                # Organizer links: prefetch the through rows with their
                # related organizer to avoid N+1 on the nested serializer.
                'event_organizer_links__organizer',
                # Partner links: prefetch the through rows with their
                # related partner.
                'event_partner_links__partner',
                # Side events: prefetch the through rows with their side event.
                'side_event_links__side_event',
                # Parent event backlink (if this event is a side event).
                'parent_event_links__parent_event',
            )

        elif action == 'list':
            from django.utils import timezone as _tz
            now = _tz.now().date()

            # For list view - annotate counts, sort priority, and
            # exclude side events by default.
            qs = qs.annotate(
                _organizers_count=Count(
                    'event_organizer_links',
                    filter=Q(event_organizer_links__is_deleted=False),
                    distinct=True,
                ),
                _partners_count=Count(
                    'event_partner_links',
                    filter=Q(event_partner_links__is_deleted=False),
                    distinct=True,
                ),
                _parent_link_count=Count(
                    'parent_event_links',
                    filter=Q(parent_event_links__is_deleted=False),
                    distinct=True,
                ),
                # Sort priority: 0 = upcoming, 1 = past.
                # Upcoming events appear first in the default list.
                _sort_priority=Case(
                    When(start_date__gte=now, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                ),
            )

            # Default: exclude side events from the main list so they
            # only appear nested under their parent event's detail page.
            # The frontend can opt-in to include them with
            # ?is_side_event=true, or explicitly request ?main_events_only=true.
            request = getattr(self, 'request', None)
            params = getattr(request, 'query_params', {})
            has_explicit_side_event_filter = any(
                p in params for p in ('is_side_event', 'main_events_only',
                                       'exclude_side_events', 'parent_event',
                                       'has_side_events')
            )
            if not has_explicit_side_event_filter:
                qs = qs.filter(_parent_link_count=0)

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
                'inquiries', 'programs', 'partner_logos', 'resources',
                'event_organizer_links__organizer',
                'event_partner_links__partner',
            )

        # Apply efficient ordering based on common queries.
        # List: upcoming first (nearest date), then past (oldest first),
        #       then by start_time, manual order, and created date.
        #       Client can override with ?o=<field>.
        # Past/upcoming/calendar actions: keep their existing orderings.
        if action == 'list':
            qs = qs.order_by(
                '_sort_priority',    # 0 = upcoming first, 1 = past
                'start_date',        # nearest date first for upcoming
                'start_time',        # earliest time first
                'order',             # manual order (tiebreaker)
                'created',           # stable fallback
            )
        elif action in ['past']:
            qs = qs.order_by('-end_date', 'order')
        elif action in ['upcoming']:
            qs = qs.order_by('start_date', 'start_time', 'order')
        else:
            qs = qs.order_by('-start_date', 'order')

        # Filter out soft-deleted items
        if hasattr(Event, 'is_deleted'):
            qs = qs.filter(is_deleted=False)

        logger.debug(
            f"EventViewSet.get_queryset: optimized for action={action}")
        return qs

    def list(self, request, *_args, **_kwargs):
        """Override list to add caching and measure timing"""
        import time
        from django.core.cache import cache
        from urllib.parse import urlencode

        t0 = time.time()

        # Deterministic cache key based on sorted full query params
        query_params = request.query_params.lists()
        cache_key = f"events_list:{urlencode(sorted(query_params), doseq=True)}"

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

    def retrieve(self, request, *_args, **_kwargs):
        """Override retrieve to add caching for individual events"""
        from django.core.cache import cache
        from urllib.parse import urlencode
        import time

        t0 = time.time()

        # Get the lookup value (slug or ID)
        lookup_value = _kwargs.get(self.lookup_field, _kwargs.get('pk'))
        params = request.query_params.lists()
        cache_key = f"event_detail:{lookup_value}:{urlencode(sorted(params), doseq=True)}"

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

    @extend_schema(
        summary='List featured events',
        description='Returns events where event_tag is set to featured.',
    )
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Get featured events"""
        queryset = self.get_queryset().filter(event_tag=Event.EventTag.FEATURED)

        # Apply filters and pagination
        queryset = self.filter_queryset(queryset)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class InquiryViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Inquiry ViewSet for event-related inquiries"""
    queryset = Inquiry.objects.all()
    filter_backends = [django_filters.DjangoFilterBackend,
                       filters.SearchFilter, filters.OrderingFilter]
    filterset_class = InquiryFilter
    search_fields: ClassVar[List[str]] = ['inquiry', 'role', 'email']
    ordering_fields: ClassVar[List[str]] = ['role', 'email', 'order']
    ordering: ClassVar[List[str]] = ['order']

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('inquiry_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('inquiry_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response
    pagination_class = StandardPageNumberPagination

    # Performance optimization
    select_related_fields: Optional[List[str]] = ['event']
    list_only_fields: Optional[List[str]] = [
        'id', 'inquiry', 'role', 'email', 'order', 'event']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return InquiryListSerializer
        return InquiryDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Inquiry, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('event').order_by('order')


class ProgramViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('program_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('program_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class SessionViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('session_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('session_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class PartnerLogoViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('partnerlogo_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('partnerlogo_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class ResourceViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('resource_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('resource_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class OrganizerViewSet(SlugModelViewSetMixin, CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only Organizer ViewSet with slug/id lookup and caching."""
    queryset = Organizer.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields: ClassVar[List[str]] = ['name', 'slug', 'description', 'website_url']
    ordering_fields: ClassVar[List[str]] = ['order', 'name', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'name']
    slug_filter_fields = ('slug',)
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        return OrganizerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Organizer, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs

    def list(self, request, *args, **kwargs):
        cache_key = self.get_cache_key('organizer_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        identifier = str(kwargs.get(self.lookup_url_kwarg, kwargs.get('pk', '')))
        cache_key = self.get_cache_key('organizer_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class EventOrganizerViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only view for the EventOrganizer through model."""
    queryset = EventOrganizer.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields: ClassVar[List[str]] = [
        'event__title', 'event__slug', 'organizer__name', 'organizer__slug',
    ]
    ordering_fields: ClassVar[List[str]] = ['order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'id']
    pagination_class = StandardPageNumberPagination
    select_related_fields: ClassVar[List[str]] = ['event', 'organizer']

    def get_serializer_class(self):  # type: ignore[override]
        return EventOrganizerLinkSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(EventOrganizer, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs.select_related('event', 'organizer').order_by('order', 'id')

    def list(self, request, *args, **kwargs):
        cache_key = self.get_cache_key('event_organizer_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('event_organizer_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class EventSideEventViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only view for the EventSideEvent through model."""
    queryset = EventSideEvent.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields: ClassVar[List[str]] = [
        'parent_event__title', 'parent_event__slug',
        'side_event__title', 'side_event__slug', 'label',
    ]
    ordering_fields: ClassVar[List[str]] = ['order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'id']
    pagination_class = StandardPageNumberPagination
    select_related_fields: ClassVar[List[str]] = ['parent_event', 'side_event']

    def get_serializer_class(self):  # type: ignore[override]
        from ..serializers.event import EventSideEventSummarySerializer
        return EventSideEventSummarySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(EventSideEvent, 'is_deleted'):
            qs = qs.filter(
                is_deleted=False,
                parent_event__is_deleted=False,
                side_event__is_deleted=False,
            )
        return qs.select_related('parent_event', 'side_event').order_by('order', 'id')

    def list(self, request, *args, **kwargs):
        cache_key = self.get_cache_key('event_side_event_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('event_side_event_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class EventPartnerCatalogViewSet(SlugModelViewSetMixin, CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only Partner ViewSet with slug/id lookup and caching."""
    queryset = Partner.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields: ClassVar[List[str]] = ['name', 'slug', 'description', 'website_url']
    ordering_fields: ClassVar[List[str]] = ['order', 'name', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'name']
    slug_filter_fields = ('slug',)
    pagination_class = StandardPageNumberPagination

    def get_serializer_class(self):  # type: ignore[override]
        return PartnerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(Partner, 'is_deleted'):
            qs = qs.filter(is_deleted=False)
        return qs

    def list(self, request, *args, **kwargs):
        cache_key = self.get_cache_key('partner_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        identifier = str(kwargs.get(self.lookup_url_kwarg, kwargs.get('pk', '')))
        cache_key = self.get_cache_key('partner_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class EventPartnerViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only view for the EventPartner through model."""
    queryset = EventPartner.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields: ClassVar[List[str]] = [
        'event__title', 'event__slug', 'partner__name', 'partner__slug',
    ]
    ordering_fields: ClassVar[List[str]] = ['order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'id']
    pagination_class = StandardPageNumberPagination
    select_related_fields: ClassVar[List[str]] = ['event', 'partner']

    def get_serializer_class(self):  # type: ignore[override]
        return EventPartnerLinkSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if hasattr(EventPartner, 'is_deleted'):
            qs = qs.filter(
                is_deleted=False,
                event__is_deleted=False,
                partner__is_deleted=False,
            )
        return qs.select_related('event', 'partner').order_by('order', 'id')

    def list(self, request, *args, **kwargs):
        cache_key = self.get_cache_key('event_partner_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('event_partner_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response
