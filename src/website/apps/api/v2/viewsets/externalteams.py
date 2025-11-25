"""
ExternalTeams app viewsets for v2 API
"""
from django_filters import rest_framework as django_filters
from rest_framework import viewsets, filters
from rest_framework.response import Response
from typing import Optional, List, ClassVar

from apps.externalteams.models import ExternalTeamMember, ExternalTeamMemberBiography
from ..filters.externalteams import ExternalTeamMemberFilter, ExternalTeamMemberBiographyFilter
from ..pagination import StandardPageNumberPagination
from ..serializers.externalteams import (
    ExternalTeamMemberListSerializer, ExternalTeamMemberDetailSerializer,
    ExternalTeamMemberBiographyListSerializer, ExternalTeamMemberBiographyDetailSerializer
)
from ..utils import OptimizedQuerySetMixin, CachedViewSetMixin


class ExternalTeamMemberViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for ExternalTeamMember

    Provides comprehensive filtering for external team member profiles
    """
    queryset = ExternalTeamMember.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = ExternalTeamMemberFilter
    search_fields: ClassVar[List[str]] = ['name', 'title']
    ordering_fields: ClassVar[List[str]] = [
        'name', 'title', 'order', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['order', 'name']
    pagination_class = StandardPageNumberPagination

    # Optimization settings
    # No foreign keys to optimize
    select_related_fields: Optional[List[str]] = []
    prefetch_related_fields: Optional[List[str]] = ['descriptions']
    list_only_fields: Optional[List[str]] = ['id', 'name', 'title',
                                             'picture', 'order', 'created', 'modified']

    def get_serializer_class(self):  # type: ignore[override]
        if self.action == 'list':
            return ExternalTeamMemberListSerializer
        return ExternalTeamMemberDetailSerializer

    def get_queryset(self):
        """Optimized queryset with prefetch for descriptions"""
        queryset = super().get_queryset()

        # Filter out deleted members
        if hasattr(self.queryset.model, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        # For detail view, prefetch related descriptions
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('descriptions')

        return queryset

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('external_team_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('external_team_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class ExternalTeamMemberBiographyViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for ExternalTeamMemberBiography

    Provides access to external team member descriptions and biographies
    """
    queryset = ExternalTeamMemberBiography.objects.all()
    filter_backends = [
        django_filters.DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = ExternalTeamMemberBiographyFilter
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
            return ExternalTeamMemberBiographyListSerializer
        return ExternalTeamMemberBiographyDetailSerializer
