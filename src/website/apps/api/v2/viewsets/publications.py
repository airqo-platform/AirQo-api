"""
Publications app viewsets for v2 API with universal slug support
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from rest_framework.response import Response
from typing import Optional, List, ClassVar

from apps.publications.models import Publication
from ..filters.publications import PublicationFilter
from ..pagination import StandardPageNumberPagination
from ..serializers.publications import PublicationListSerializer, PublicationDetailSerializer
from ..mixins import SlugModelViewSetMixin, OptimizedQuerySetMixin
from ..utils import CachedViewSetMixin


class PublicationViewSet(SlugModelViewSetMixin, CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Publication with privacy-friendly slug URLs

    Features:
    - Privacy-friendly slug URLs (e.g., /publications/air-quality-policy-brief-2025/)
    - Automatic ID hiding when slugs exist
    - Document management with publication type filtering
    - Backward compatibility with ID-based URLs
    """
    queryset = Publication.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = PublicationFilter
    search_fields: ClassVar[List[str]] = ['title', 'authors', 'description']
    ordering_fields: ClassVar[List[str]] = ['title', 'authors',
                                            'category', 'order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', '-created']
    pagination_class = StandardPageNumberPagination

    # Slug configuration
    slug_filter_fields = ('slug',)  # Publication uses standard slug field

    # Optimization settings
    # No foreign keys to optimize
    select_related_fields: Optional[List[str]] = []
    prefetch_related_fields: Optional[List[str]] = []  # No M2M relationships
    list_only_fields: Optional[List[str]] = [
        # Model fields for list view optimization
        'id', 'title', 'authors', 'category', 'link', 'link_title',
        'resource_file', 'order', 'created', 'modified'
        # Note: Slug fields added automatically by mixin
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PublicationListSerializer
        return PublicationDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(Publication, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)
        return queryset

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('publication_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('slug', ''))
        cache_key = self.get_cache_key('publication_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response
