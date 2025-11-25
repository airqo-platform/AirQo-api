# Career app viewsets
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.response import Response

from apps.career.models import Career, Department
from ..serializers.career import CareerListSerializer, CareerDetailSerializer, DepartmentListSerializer, DepartmentDetailSerializer
from ..filters.career import CareerFilterSet, DepartmentFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin, CachedViewSetMixin
from ..mixins import SlugModelViewSetMixin
from typing import Optional, List, ClassVar


class DepartmentViewSet(CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = DepartmentFilterSet
    search_fields = ['name']
    ordering_fields = ['id', 'name']
    ordering = ['name']

    def get_serializer_class(self):  # type: ignore[override]
        return DepartmentListSerializer if self.action == 'list' else DepartmentDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(Department, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)
        return queryset

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('department_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('pk', ''))
        cache_key = self.get_cache_key('department_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response


class CareerViewSet(SlugModelViewSetMixin, CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Career.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CareerFilterSet
    search_fields = ['title', 'type']
    ordering_fields = ['id', 'title', 'closing_date', 'created', 'modified']
    ordering = ['-closing_date', 'title']
    # Keep select_related minimal at class level; expensive prefetch only for retrieve
    select_related_fields: Optional[List[str]] = ['department']
    # heavy prefetch applied only in get_queryset for retrieve
    prefetch_related_fields: Optional[List[str]] = None

    def get_serializer_class(self):  # type: ignore[override]
        return CareerListSerializer if self.action == 'list' else CareerDetailSerializer

    def get_queryset(self):
        """Optimized queryset with prefetch for related data"""
        queryset = super().get_queryset()

        # Filter out deleted careers
        if hasattr(Career, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)

        # For detail view, ensure all related data is prefetched (expensive nested prefetch)
        if self.action == 'retrieve':
            queryset = queryset.select_related('department').prefetch_related(
                'descriptions',
                'bullets__bullet_points'
            )

        return queryset

    def list(self, request, *args, **kwargs):
        """Cached list view"""
        cache_key = self.get_cache_key('career_list', query_params=request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        """Cached detail view"""
        identifier = str(kwargs.get('slug', ''))
        cache_key = self.get_cache_key('career_detail', identifier, request.query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response
