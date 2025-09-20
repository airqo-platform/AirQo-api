"""
African Cities app viewsets for v2 API

Optimized to return complete nested data structure for countries with cities,
content, descriptions, and images as shown in the requirements.
"""
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from typing import Optional, List
from django_filters.rest_framework import DjangoFilterBackend

from apps.africancities.models import AfricanCountry
from ..serializers.africancities import AfricanCountryListSerializer, AfricanCountryDetailSerializer
from ..filters.africancities import AfricanCountryFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin
import logging

logger = logging.getLogger(__name__)


class AfricanCountryViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """ViewSet for AfricanCountry model with complete nested data"""
    queryset = AfricanCountry.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AfricanCountryFilterSet

    search_fields = ['country_name']
    ordering_fields = ['id', 'country_name', 'order', 'created', 'modified']
    ordering = ['order', 'country_name']

    # Optimization - no foreign keys to select_related
    list_only_fields: Optional[List[str]] = ['id', 'country_name',
                                             'country_flag', 'order', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return AfricanCountryListSerializer
        return AfricanCountryDetailSerializer

    def get_queryset(self):
        """Optimized queryset with complete nested prefetching"""
        queryset = super().get_queryset()

        if hasattr(AfricanCountry, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        action = getattr(self, 'action', None)

        if action == 'retrieve':
            # For detail view - prefetch ALL nested data
            queryset = queryset.prefetch_related(
                'city',                           # Cities
                'city__content',                  # Content for each city
                'city__content__description',     # Descriptions for each content
                'city__content__image'            # Images for each content
            )
        elif action == 'list':
            # For list view - just prefetch city count for efficiency
            queryset = queryset.prefetch_related('city')
            if self.list_only_fields:
                queryset = queryset.only(*self.list_only_fields)

        return queryset.order_by('order', 'country_name')
