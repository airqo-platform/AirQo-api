# Career app filters
import django_filters
from apps.career.models import Career, Department


class DepartmentFilterSet(django_filters.FilterSet):
    name_contains = django_filters.CharFilter(
        field_name='name', lookup_expr='icontains')

    class Meta:
        model = Department
        fields = {'name': ['exact', 'icontains']}


class CareerFilterSet(django_filters.FilterSet):
    title_contains = django_filters.CharFilter(
        field_name='title', lookup_expr='icontains')
    closing_date_after = django_filters.DateFilter(
        field_name='closing_date', lookup_expr='gte')
    closing_date_before = django_filters.DateFilter(
        field_name='closing_date', lookup_expr='lte')

    class Meta:
        model = Career
        fields = {
            'title': ['exact', 'icontains'],
            'type': ['exact', 'icontains'],
            'closing_date': ['exact', 'gte', 'lte'],
            'department': ['exact'],
        }
