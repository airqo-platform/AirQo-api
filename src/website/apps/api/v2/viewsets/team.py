"""
Team app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters

from apps.team.models import Member, MemberBiography
from ..filters.team import MemberFilter, MemberBiographyFilter
from ..pagination import StandardPageNumberPagination
from ..permissions import DefaultAPIPermission
from ..serializers.team import (
    MemberListSerializer, MemberDetailSerializer,
    MemberBiographyListSerializer, MemberBiographyDetailSerializer
)
from ..utils import OptimizedQuerySetMixin


class MemberViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Member

    Provides internal team member profiles with department hierarchy
    """
    queryset = Member.objects.all()
    permission_classes = [DefaultAPIPermission]
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = MemberFilter
    search_fields = ['name', 'title', 'about']
    ordering_fields = ['name', 'title', 'order', 'created', 'modified']
    ordering = ['order', 'name']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields = []  # No foreign keys to optimize
    prefetch_related_fields = ['descriptions']
    list_only_fields = [
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
    permission_classes = [DefaultAPIPermission]
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = MemberBiographyFilter
    search_fields = ['description', 'member__name']
    ordering_fields = ['order', 'member__name']
    ordering = ['order']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    select_related_fields = ['member']
    prefetch_related_fields = []
    list_only_fields = ['id', 'description', 'order', 'member']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return MemberBiographyListSerializer
        return MemberBiographyDetailSerializer
