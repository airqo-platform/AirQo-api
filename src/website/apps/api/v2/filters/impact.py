"""
Impact app filters for v2 API
"""
import django_filters
from apps.impact.models import ImpactNumber


class ImpactNumberFilterSet(django_filters.FilterSet):
    """
    Filter set for ImpactNumber
    Basic filtering since it's typically a single record
    """
    # Date range filters
    created_after = django_filters.DateTimeFilter(
        field_name='created', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(
        field_name='created', lookup_expr='lte')
    modified_after = django_filters.DateTimeFilter(
        field_name='modified', lookup_expr='gte')
    modified_before = django_filters.DateTimeFilter(
        field_name='modified', lookup_expr='lte')

    # Range filters for numerical values
    african_cities_min = django_filters.NumberFilter(
        field_name='african_cities', lookup_expr='gte')
    african_cities_max = django_filters.NumberFilter(
        field_name='african_cities', lookup_expr='lte')
    champions_min = django_filters.NumberFilter(
        field_name='champions', lookup_expr='gte')
    champions_max = django_filters.NumberFilter(
        field_name='champions', lookup_expr='lte')
    deployed_monitors_min = django_filters.NumberFilter(
        field_name='deployed_monitors', lookup_expr='gte')
    deployed_monitors_max = django_filters.NumberFilter(
        field_name='deployed_monitors', lookup_expr='lte')

    class Meta:
        model = ImpactNumber
        fields = {
            'african_cities': ['exact', 'gte', 'lte'],
            'champions': ['exact', 'gte', 'lte'],
            'deployed_monitors': ['exact', 'gte', 'lte'],
            'data_records': ['exact', 'gte', 'lte'],
            'research_papers': ['exact', 'gte', 'lte'],
            'partners': ['exact', 'gte', 'lte'],
        }
