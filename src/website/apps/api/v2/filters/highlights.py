"""
Highlights app filters for v2 API
"""
from django.db.models import Q
import django_filters
from django_filters import rest_framework as filters
from apps.highlights.models import Highlight, Tag


class HighlightFilter(filters.FilterSet):
    """Filter for Highlight model"""
    title = filters.CharFilter(lookup_expr='icontains')
    tags = filters.ModelMultipleChoiceFilter(
        queryset=Tag.objects.all(),
        field_name='tags',
        to_field_name='id'
    )
    tag_names = filters.CharFilter(method='filter_by_tag_names')
    has_image = filters.BooleanFilter(method='filter_has_image')
    has_link = filters.BooleanFilter(method='filter_has_link')

    def filter_by_tag_names(self, queryset, name, value):
        """Filter by tag names (comma-separated)"""
        if value:
            tag_names = [name.strip() for name in value.split(',')]
            return queryset.filter(tags__name__in=tag_names).distinct()
        return queryset

    def filter_has_image(self, queryset, name, value):
        """Filter by highlights with images"""
        if value:
            return queryset.exclude(image__isnull=True).exclude(image='')
        return queryset.filter(Q(image__isnull=True) | Q(image=''))

    def filter_has_link(self, queryset, name, value):
        """Filter by highlights with external links"""
        if value:
            return queryset.exclude(link__isnull=True).exclude(link='')
        return queryset.filter(Q(link__isnull=True) | Q(link=''))

    class Meta:
        model = Highlight
        fields = {
            'title': ['exact', 'icontains'],
            'link': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
            'created': ['exact', 'gte', 'lte'],
            'modified': ['exact', 'gte', 'lte'],
        }


class TagFilter(filters.FilterSet):
    """Filter for Tag model"""
    name = filters.CharFilter(lookup_expr='icontains')
    has_highlights = filters.BooleanFilter(method='filter_has_highlights')

    def filter_has_highlights(self, queryset, name, value):
        """Filter tags that have highlights"""
        if value:
            return queryset.filter(highlights__isnull=False).distinct()
        return queryset.filter(highlights__isnull=True)

    class Meta:
        model = Tag
        fields = {
            'name': ['exact', 'icontains'],
            'created': ['exact', 'gte', 'lte'],
            'modified': ['exact', 'gte', 'lte'],
        }
