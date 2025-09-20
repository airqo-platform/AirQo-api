"""
FAQs app viewsets for v2 API
"""
from rest_framework import viewsets
from django.db.models.query import QuerySet
from typing import Any, ClassVar, Optional, List
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.faqs.models import FAQ
from ..serializers.faqs import FAQListSerializer, FAQDetailSerializer
from ..filters.faqs import FAQFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin


class FAQViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for FAQ model

    Provides read-only access to frequently asked questions.

    Supports:
    - Filtering by active status and date ranges
    - Search across question and answer fields
    - Ordering by any field
    - Dynamic field selection via ?fields= and ?omit=
    """
    queryset = FAQ.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = FAQFilterSet

    # Search configuration
    search_fields: ClassVar[list[str]] = [
        'question',
        'answer',
    ]

    # Ordering configuration
    ordering_fields: ClassVar[list[str]] = [
        'id',
        'order',
        'question',
        'is_active',
        'created_at',
        'updated_at',
    ]
    # Default to manual order, then newest
    ordering: ClassVar[list[str]] = ['order', '-created_at']

    # List optimization - only include basic fields for performance
    # Match the base mixin signature (Optional[List[str]]) to avoid Pylance
    # incompatible override warnings while still allowing a class-level
    # default value for subclasses to override.
    list_only_fields: Optional[List[str]] = [
        'id',
        'question',
        'answer',
        'is_active',
        'created_at',
        'updated_at'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        """
        Return appropriate serializer based on action
        """
        if self.action == 'list':
            return FAQListSerializer
        return FAQDetailSerializer

    def get_queryset(self) -> Any:  # type: ignore[override]
        """Optimized queryset for FAQs"""
        from rest_framework.request import Request as DRFRequest
        from typing import cast

        queryset = super().get_queryset()

        # By default, only show active FAQs unless specifically filtered
        request = cast(DRFRequest, getattr(self, 'request', None))
        if request is None or not request.query_params.get('is_active'):
            queryset = queryset.filter(is_active=True)

        return queryset
