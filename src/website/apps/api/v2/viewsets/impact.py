"""
Impact app viewsets for v2 API
"""
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.impact.models import ImpactNumber
from ..serializers.impact import ImpactNumberListSerializer, ImpactNumberDetailSerializer
from ..filters.impact import ImpactNumberFilterSet
from ..pagination import StandardPageNumberPagination
from ..permissions import OpenAPIPermission
from ..utils import OptimizedQuerySetMixin


class ImpactNumberViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for ImpactNumber model

    Provides read-only access to impact numbers/statistics.
    Typically contains a single record with current statistics.

    Supports:
    - Filtering by date ranges and numerical ranges
    - Search across all numerical fields
    - Ordering by any field
    - Dynamic field selection via ?fields= and ?omit=
    """
    queryset = ImpactNumber.objects.all()
    permission_classes = [OpenAPIPermission]
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = ImpactNumberFilterSet

    # Search configuration
    search_fields = [
        'african_cities',
        'champions',
        'deployed_monitors',
        'data_records',
        'research_papers',
        'partners'
    ]

    # Ordering configuration
    ordering_fields = [
        'id',
        'african_cities',
        'champions',
        'deployed_monitors',
        'data_records',
        'research_papers',
        'partners',
        'created',
        'modified'
    ]
    ordering = ['-modified']  # Default to most recently modified

    def get_serializer_class(self):  # type: ignore[override]
        """
        Return appropriate serializer based on action
        """
        if self.action == 'list':
            return ImpactNumberListSerializer
        return ImpactNumberDetailSerializer

    def get_queryset(self):
        """
        Optimized queryset for impact numbers
        """
        queryset = super().get_queryset()

        # Impact numbers don't have related fields, so no need for select_related/prefetch_related
        # But we ensure we don't load deleted records
        if hasattr(ImpactNumber, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        return queryset
