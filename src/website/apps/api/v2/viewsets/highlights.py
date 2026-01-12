"""
Highlights app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from rest_framework.response import Response
from typing import Optional, List, ClassVar

from apps.highlights.models import Highlight, Tag
from ..filters.highlights import HighlightFilter, TagFilter
from ..pagination import StandardPageNumberPagination
from ..serializers.highlights import (
    HighlightListSerializer, HighlightDetailSerializer,
    TagListSerializer, TagDetailSerializer
)
from ..utils import OptimizedQuerySetMixin, CachedViewSetMixin


class HighlightViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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
    search_fields: ClassVar[List[str]] = ['title', 'link_title', 'tags__name']
    ordering_fields: ClassVar[List[str]] = [
        'title', 'order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', '-created']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields: Optional[List[str]] = []
    prefetch_related_fields: Optional[List[str]] = ['tags']
    list_only_fields: Optional[List[str]] = ['id', 'title', 'image', 'link',
                                             'link_title', 'order', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return HighlightListSerializer
        return HighlightDetailSerializer

    def get_queryset(self):
        """Optimized queryset with prefetch for tags"""
        queryset = super().get_queryset()

        # Filter out deleted highlights
        if hasattr(Highlight, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        # Always prefetch tags as they're needed for display
        queryset = queryset.prefetch_related('tags')

        return queryset

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('highlight_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('highlight_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class TagViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
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
    search_fields: ClassVar[List[str]] = ['name']
    ordering_fields: ClassVar[List[str]] = ['name', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['name']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields: Optional[List[str]] = []
    prefetch_related_fields: Optional[List[str]] = ['highlights']
    list_only_fields: Optional[List[str]] = [
        'id', 'name', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return TagListSerializer
        return TagDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(Tag, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)
        return queryset

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('tag_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('tag_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response
