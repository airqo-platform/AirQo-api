"""
Publications app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters

from apps.publications.models import Publication
from ..filters.publications import PublicationFilter
from ..pagination import StandardPageNumberPagination
from ..permissions import DefaultAPIPermission
from ..serializers.publications import PublicationListSerializer, PublicationDetailSerializer
from ..utils import OptimizedQuerySetMixin


class PublicationViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Publication

    Provides document management with publication type filtering
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

    # Optimization settings
    select_related_fields = []  # No foreign keys to optimize
    prefetch_related_fields = []  # No M2M relationships
    list_only_fields = [
        'id', 'title', 'authors', 'category', 'link', 'link_title',
        'resource_file', 'order', 'created', 'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PublicationListSerializer
        return PublicationDetailSerializer
