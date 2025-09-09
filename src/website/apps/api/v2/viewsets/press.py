"""
Press app viewsets for v2 API
"""
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.press.models import Press
from ..serializers.press import PressListSerializer, PressDetailSerializer
from ..filters.press import PressFilterSet
from ..pagination import StandardPageNumberPagination
from ..permissions import DefaultAPIPermission
from ..utils import OptimizedQuerySetMixin
from ..mixins import SlugModelViewSetMixin


class PressViewSet(SlugModelViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Press model

    Provides read-only access to press articles and media coverage.

    Supports:
    - Filtering by date, category, and text content
    - Search across title and intro fields
    - Ordering by publication date, order, and other fields
    - Dynamic field selection via ?fields= and ?omit=
    - Privacy-friendly slug-based URLs

    Special endpoints:
    - /recent/ - Get recent press articles (last 30 days)
    - /categories/ - Get available categories
    """
    queryset = Press.objects.all()
    permission_classes = [DefaultAPIPermission]
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PressFilterSet

    # Search configuration
    search_fields = [
        'article_title',
        'article_intro',
    ]

    # Ordering configuration
    ordering_fields = [
        'id',
        'article_title',
        'date_published',
        'website_category',
        'order',
        'created',
        'modified',
    ]
    # Default to newest first, then by order
    ordering = ['-date_published', 'order']

    # List optimization - only include essential fields for performance
    list_only_fields = [
        'id',
        'article_title',
        'article_intro',
        'date_published',
        'publisher_logo',
        'website_category',
        'order',
        'created',
        'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        """
        Return appropriate serializer based on action
        """
        if self.action == 'list':
            return PressListSerializer
        return PressDetailSerializer

    def get_queryset(self):
        """
        Optimized queryset for press articles
        """
        queryset = super().get_queryset()

        # Filter out deleted records
        if hasattr(Press, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        return queryset

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """
        Get recent press articles from the last 30 days
        """
        from django.utils import timezone
        thirty_days_ago = timezone.now().date() - timezone.timedelta(days=30)

        queryset = self.get_queryset().filter(date_published__gte=thirty_days_ago)
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
        Get available press categories
        """
        categories = []
        if hasattr(Press, 'WebsiteCategory'):
            categories = [
                {'value': choice[0], 'label': choice[1]}
                for choice in Press.WebsiteCategory.choices
            ]

        return Response({'categories': categories})
