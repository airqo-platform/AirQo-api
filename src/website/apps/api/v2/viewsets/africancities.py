"""
African Cities app viewsets for v2 API
"""
from typing import Type
from rest_framework import viewsets, serializers
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.africancities.models import AfricanCountry
from ..serializers.africancities import AfricanCountryListSerializer, AfricanCountryDetailSerializer
from ..filters.africancities import AfricanCountryFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin


class AfricanCountryViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """ViewSet for AfricanCountry model"""
    queryset = AfricanCountry.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AfricanCountryFilterSet

    search_fields = ['country_name']
    ordering_fields = ['id', 'country_name', 'order', 'created', 'modified']
    ordering = ['order', 'country_name']

    # Optimization
    prefetch_related_fields = ['city']
    list_only_fields = ['id', 'country_name',
                        'country_flag', 'order', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return AfricanCountryListSerializer
        return AfricanCountryDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(AfricanCountry, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)
        return queryset
