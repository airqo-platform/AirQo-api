"""
Highlights app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters

from apps.highlights.models import Highlight, Tag
from ..filters.highlights import HighlightFilter, TagFilter
from ..pagination import StandardPageNumberPagination
from ..serializers.highlights import (
    HighlightListSerializer, HighlightDetailSerializer,
    TagListSerializer, TagDetailSerializer
)
from ..utils import OptimizedQuerySetMixin


class HighlightViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Highlight

    Provides comprehensive filtering for highlights with tag-based organization
    """
    queryset = Highlight.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = HighlightFilter
    search_fields = ['title', 'link_title', 'tags__name']
    ordering_fields = ['title', 'order', 'created', 'modified']
    ordering = ['order', '-created']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields = []
    prefetch_related_fields = ['tags']
    list_only_fields = ['id', 'title', 'image', 'link',
                        'link_title', 'order', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return HighlightListSerializer
        return HighlightDetailSerializer

    def get_queryset(self):
        """Optimized queryset with prefetch for tags"""
        queryset = super().get_queryset()

        # Always prefetch tags as they're needed for display
        queryset = queryset.prefetch_related('tags')

        return queryset


class TagViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Tag

    Provides access to highlight tags with filtering capabilities
    """
    queryset = Tag.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = TagFilter
    search_fields = ['name']
    ordering_fields = ['name', 'created', 'modified']
    ordering = ['name']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields = []
    prefetch_related_fields = ['highlights']
    list_only_fields = ['id', 'name', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return TagListSerializer
        return TagDetailSerializer
