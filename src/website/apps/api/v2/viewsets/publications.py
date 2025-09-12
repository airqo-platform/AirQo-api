"""
Publications app viewsets for v2 API with universal slug support
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters

from apps.publications.models import Publication
from ..filters.publications import PublicationFilter
from ..pagination import StandardPageNumberPagination
from ..permissions import DefaultAPIPermission
from ..serializers.publications import PublicationListSerializer, PublicationDetailSerializer
from ..mixins import SlugModelViewSetMixin, OptimizedQuerySetMixin


class PublicationViewSet(SlugModelViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Publication with privacy-friendly slug URLs

    Features:
    - Privacy-friendly slug URLs (e.g., /publications/air-quality-policy-brief-2025/)
    - Automatic ID hiding when slugs exist
    - Document management with publication type filtering
    - Backward compatibility with ID-based URLs
    """
    queryset = Publication.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = PublicationFilter
    search_fields = ['title', 'authors', 'description']
    ordering_fields = ['title', 'authors',
                       'category', 'order', 'created', 'modified']
    ordering = ['order', '-created']
    pagination_class = StandardPageNumberPagination

    # Slug configuration
    slug_filter_fields = ['slug']  # Publication uses standard slug field

    # Optimization settings
    select_related_fields = []  # No foreign keys to optimize
    prefetch_related_fields = []  # No M2M relationships
    list_only_fields = [
        # Model fields for list view optimization
        'id', 'title', 'authors', 'category', 'link', 'link_title',
        'resource_file', 'order', 'created', 'modified'
        # Note: Slug fields added automatically by mixin
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PublicationListSerializer
        return PublicationDetailSerializer
