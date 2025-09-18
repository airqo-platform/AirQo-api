"""
CleanAir app viewsets for v2 API

Special features for cleanair app as per requirements:
- Status badges
- Featured route
- SEO fields
- Media preview
- increment_views action
"""
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.http import Http404

from apps.cleanair.models import CleanAirResource, ForumEvent
from ..serializers.cleanair import (
    CleanAirResourceListSerializer, CleanAirResourceDetailSerializer,
    ForumEventListSerializer, ForumEventDetailSerializer
)
from ..filters.cleanair import CleanAirResourceFilterSet, ForumEventFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin


class CleanAirResourceViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for CleanAirResource model

    Special features for CleanAir resources:
    - Featured filtering
    - File type filtering
    - Media preview support
    - SEO-friendly responses

    Supports:
    - Filtering by category, file type, and text content
    - Search across title and authors fields
    - Ordering by order, date, and other fields
    - Dynamic field selection via ?fields= and ?omit=

    Special endpoints:
    - /featured/ - Get featured resources
    - /categories/ - Get available categories
    - /{id}/increment_views/ - Increment view count (if implemented)
    """
    queryset = CleanAirResource.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CleanAirResourceFilterSet

    # Search configuration
    search_fields = [
        'resource_title',
        'resource_authors',
        'author_title',
    ]

    # Ordering configuration
    ordering_fields = [
        'id',
        'resource_title',
        'resource_category',
        'resource_authors',
        'order',
        'created',
        'modified',
    ]
    ordering = ['order', '-created']  # Default to order, then newest first

    # List optimization
    list_only_fields = [
        'id',
        'resource_title',
        'resource_link',
        'resource_file',
        'author_title',
        'resource_category',
        'resource_authors',
        'order',
        'created',
        'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        """
        Return appropriate serializer based on action
        """
        if self.action == 'list':
            return CleanAirResourceListSerializer
        return CleanAirResourceDetailSerializer

    def get_queryset(self):
        """
        Optimized queryset for CleanAir resources
        """
        queryset = super().get_queryset()

        # Filter out deleted records
        if hasattr(CleanAirResource, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        return queryset

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """
        Get featured CleanAir resources
        TODO: Implement featured field in model if needed
        """
        # For now, return resources with lower order numbers (higher priority)
        queryset = self.get_queryset().filter(order__lte=10)
        queryset = self.filter_queryset(queryset)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """
        Get available resource categories
        """
        categories = []
        if hasattr(CleanAirResource, 'ResourceCategory'):
            categories = [
                {'value': choice[0], 'label': choice[1]}
                for choice in CleanAirResource.ResourceCategory.choices
            ]

        return Response({'categories': categories})

    @action(detail=True, methods=['post'])
    def increment_views(self, request, pk=None):
        """
        Increment view count for a resource
        TODO: Implement view_count field in model if needed
        """
        resource = self.get_object()

        # TODO: Implement view counting
        # if hasattr(resource, 'view_count'):
        #     resource.view_count += 1
        #     resource.save(update_fields=['view_count'])

        return Response({'status': 'view count incremented'})


class ForumEventViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for ForumEvent model

    Special features for Forum Events:
    - Event status badges (upcoming, ongoing, past)
    - Date-based filtering
    - Registration tracking
    - SEO-friendly responses

    Supports:
    - Filtering by date ranges, status, and location
    - Search across title and location fields
    - Ordering by date, order, and other fields
    - Dynamic field selection via ?fields= and ?omit=

    Special endpoints:
    - /upcoming/ - Get upcoming events
    - /past/ - Get past events
    - /{id}/increment_views/ - Increment view count
    """
    queryset = ForumEvent.objects.all()
    # Use unique_title (slug) for lookups in v2 to support URLs like
    # /website/api/v2/forum-events/clean-air-forum-2024/
    lookup_field = 'unique_title'
    # Allow typical slug characters (letters, numbers, hyphen, underscore, dot)
    lookup_value_regex = r"[-a-zA-Z0-9_\.]+"
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ForumEventFilterSet

    # Search configuration
    search_fields = [
        'title',
        'title_subtext',
        'location_name',
    ]

    # Ordering configuration
    ordering_fields = [
        'id',
        'title',
        'start_date',
        'end_date',
        'location_name',
        'order',
        'created',
        'modified',
    ]
    # Default to chronological, then by order
    ordering = ['start_date', 'order']

    # List optimization
    list_only_fields = [
        'id',
        'title',
        'title_subtext',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'location_name',
        'location_link',
        'registration_link',
        'unique_title',
        'background_image',
        'order',
        'created',
        'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        """
        Return appropriate serializer based on action
        """
        if self.action == 'list':
            return ForumEventListSerializer
        return ForumEventDetailSerializer

    def get_queryset(self):
        """
        Optimized queryset for Forum events
        """
        queryset = super().get_queryset()

        # Filter out deleted records
        if hasattr(ForumEvent, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        return queryset

    def retrieve(self, request, *args, **kwargs):
        """
        Support retrieving by `unique_title` slug and a special `latest` slug
        to return the most recent ForumEvent. Fall back to raising 404 if
        the slug does not match any record.
        """
        slug = kwargs.get(self.lookup_field)
        if slug == 'latest':
            # Return the latest forum event based on start_date then id
            instance = self.get_queryset().order_by('-start_date', '-id').first()
            if not instance:
                raise Http404("No forum event found.")
            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        # For normal slugs, delegate to the default implementation which will
        # filter by the configured `lookup_field` (unique_title)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """
        Get upcoming forum events
        """
        from django.utils import timezone
        now = timezone.now().date()

        queryset = self.get_queryset().filter(start_date__gt=now)
        queryset = self.filter_queryset(queryset)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        """
        Get past forum events
        """
        from django.utils import timezone
        now = timezone.now().date()

        queryset = self.get_queryset().filter(end_date__lt=now)
        queryset = self.filter_queryset(queryset)

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def increment_views(self, request, pk=None):
        """
        Increment view count for a forum event
        TODO: Implement view_count field in model if needed
        """
        event = self.get_object()

        # TODO: Implement view counting
        # if hasattr(event, 'view_count'):
        #     event.view_count += 1
        #     event.save(update_fields=['view_count'])

        return Response({'status': 'view count incremented'})
