"""
Team app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from typing import Optional, List, ClassVar

from apps.team.models import Member, MemberBiography
from ..filters.team import MemberFilter, MemberBiographyFilter
from ..pagination import StandardPageNumberPagination
from ..serializers.team import (
    MemberListSerializer, MemberDetailSerializer,
    MemberBiographyListSerializer, MemberBiographyDetailSerializer
)
from ..utils import OptimizedQuerySetMixin
from ..mixins import SlugModelViewSetMixin


class MemberViewSet(SlugModelViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Member

    Provides internal team member profiles with department hierarchy
    """
    queryset = Member.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = MemberFilter
    search_fields: ClassVar[List[str]] = ['name', 'title', 'about']
    ordering_fields: ClassVar[List[str]] = [
        'name', 'title', 'order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'name']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    # No foreign keys to optimize
    select_related_fields: Optional[List[str]] = []
    prefetch_related_fields: Optional[List[str]] = ['descriptions']
    list_only_fields: Optional[List[str]] = [
        'id', 'name', 'title', 'about', 'picture', 'twitter', 'linked_in',
        'order', 'created', 'modified'
    ]

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return MemberListSerializer
        return MemberDetailSerializer

    def get_queryset(self):
        """Optimized queryset with prefetch for descriptions"""
        queryset = super().get_queryset()

        # For detail view, prefetch related descriptions
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('descriptions')

        return queryset


class MemberBiographyViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for MemberBiography

    Provides access to team member descriptions and biographies
    """
    queryset = MemberBiography.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = MemberBiographyFilter
    search_fields: ClassVar[List[str]] = ['description', 'member__name']
    ordering_fields: ClassVar[List[str]] = ['order', 'member__name']
    ordering: ClassVar[List[str]] = ['order']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields: Optional[List[str]] = ['member']
    prefetch_related_fields: Optional[List[str]] = []
    list_only_fields: Optional[List[str]] = [
        'id', 'description', 'order', 'member']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return MemberBiographyListSerializer
        return MemberBiographyDetailSerializer
