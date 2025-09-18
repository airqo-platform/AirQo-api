# Career app viewsets
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.career.models import Career, Department
from ..serializers.career import CareerListSerializer, CareerDetailSerializer, DepartmentListSerializer, DepartmentDetailSerializer
from ..filters.career import CareerFilterSet, DepartmentFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin
from ..mixins import SlugModelViewSetMixin


class DepartmentViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = DepartmentFilterSet
    search_fields = ['name']
    ordering_fields = ['id', 'name']
    ordering = ['name']

    def get_serializer_class(self):  # type: ignore[override]
        return DepartmentListSerializer if self.action == 'list' else DepartmentDetailSerializer


class CareerViewSet(SlugModelViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Career.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CareerFilterSet
    search_fields = ['title', 'type']
    ordering_fields = ['id', 'title', 'closing_date', 'created', 'modified']
    ordering = ['-closing_date', 'title']
    select_related_fields = ['department']

    def get_serializer_class(self):  # type: ignore[override]
        return CareerListSerializer if self.action == 'list' else CareerDetailSerializer
