"""
African Cities app filters for v2 API
"""
import django_filters
from apps.africancities.models import AfricanCountry


class AfricanCountryFilterSet(django_filters.FilterSet):
    """Filter set for AfricanCountry"""
    country_name_contains = django_filters.CharFilter(
        field_name='country_name', lookup_expr='icontains')
    created_after = django_filters.DateTimeFilter(
        field_name='created', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(
        field_name='created', lookup_expr='lte')

    class Meta:
        model = AfricanCountry
        fields = {
            'country_name': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
        }
