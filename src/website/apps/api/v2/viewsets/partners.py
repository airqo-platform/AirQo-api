"""
Partners app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from typing import Optional, List, ClassVar

from apps.partners.models import Partner, PartnerDescription
from ..filters.partners import PartnerFilter, PartnerDescriptionFilter
from ..mixins import SlugModelViewSetMixin
from ..pagination import StandardPageNumberPagination
from ..serializers.partners import (
    PartnerListSerializer, PartnerDetailSerializer,
    PartnerDescriptionListSerializer, PartnerDescriptionDetailSerializer
)
from ..utils import OptimizedQuerySetMixin


class PartnerViewSet(SlugModelViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Partner

    Provides comprehensive filtering for partnership management with category filtering
    """
    queryset = Partner.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = PartnerFilter
    search_fields: ClassVar[List[str]] = [
        'partner_name', 'descriptions__description']
    ordering_fields: ClassVar[List[str]] = [
        'partner_name', 'type', 'order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'partner_name']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields: Optional[List[str]] = []
    prefetch_related_fields: Optional[List[str]] = ['descriptions']
    list_only_fields: Optional[List[str]] = [
        'id', 'partner_name', 'partner_image', 'partner_logo', 'partner_link',
        'type', 'website_category', 'order', 'created', 'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PartnerListSerializer
        return PartnerDetailSerializer

    def get_queryset(self):
        """Optimized queryset with prefetch for descriptions"""
        queryset = super().get_queryset()

        # For detail view, prefetch related descriptions to avoid N+1 queries
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('descriptions')

        return queryset


class PartnerDescriptionViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for PartnerDescription

    Provides access to partner descriptions and details
    """
    queryset = PartnerDescription.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = PartnerDescriptionFilter
    search_fields: ClassVar[List[str]] = [
        'description', 'partner__partner_name']
    ordering_fields: ClassVar[List[str]] = ['order', 'partner__partner_name']
    ordering: ClassVar[List[str]] = ['order']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields: Optional[List[str]] = ['partner']
    prefetch_related_fields: Optional[List[str]] = []
    list_only_fields: Optional[List[str]] = [
        'id', 'description', 'order', 'partner']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return PartnerDescriptionListSerializer
        return PartnerDescriptionDetailSerializer
