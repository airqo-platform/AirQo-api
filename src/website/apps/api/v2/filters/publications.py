"""
Publications app filters for v2 API
"""
from django.db.models import Q
import django_filters
from django_filters import rest_framework as filters
from apps.publications.models import Publication


class PublicationFilter(filters.FilterSet):
    """Filter for Publication model"""
    title = filters.CharFilter(lookup_expr='icontains')
    authors = filters.CharFilter(lookup_expr='icontains')
    category = filters.ChoiceFilter(choices=Publication.CategoryTypes.choices)
    description = filters.CharFilter(lookup_expr='icontains')
    has_file = filters.BooleanFilter(method='filter_has_file')
    has_link = filters.BooleanFilter(method='filter_has_link')
    has_description = filters.BooleanFilter(method='filter_has_description')

    def filter_has_file(self, queryset, name, value):
        """Filter by publications with resource files"""
        if value:
            return queryset.exclude(resource_file__isnull=True).exclude(resource_file='')
        return queryset.filter(Q(resource_file__isnull=True) | Q(resource_file=''))

    def filter_has_link(self, queryset, name, value):
        """Filter by publications with external links"""
        if value:
            return queryset.exclude(link__isnull=True).exclude(link='')
        return queryset.filter(Q(link__isnull=True) | Q(link=''))

    def filter_has_description(self, queryset, name, value):
        """Filter by publications with descriptions"""
        if value:
            return queryset.exclude(description__isnull=True).exclude(description='')
        return queryset.filter(Q(description__isnull=True) | Q(description=''))

    class Meta:
        model = Publication
        fields = {
            'title': ['exact', 'icontains'],
            'authors': ['exact', 'icontains'],
            'category': ['exact'],
            'description': ['icontains'],
            'order': ['exact', 'gte', 'lte'],
            'created': ['exact', 'gte', 'lte'],
            'modified': ['exact', 'gte', 'lte'],
        }
