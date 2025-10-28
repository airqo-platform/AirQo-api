"""
Partners app filters for v2 API
"""
from django.db.models import Q
import django_filters
from django_filters import rest_framework as filters
from apps.partners.models import Partner, PartnerDescription


class PartnerFilter(filters.FilterSet):
    """Filter for Partner model"""
    partner_name = filters.CharFilter(lookup_expr='icontains')
    type = filters.ChoiceFilter(choices=Partner.RelationTypes.choices)
    website_category = filters.ChoiceFilter(
        choices=Partner.WebsiteCategory.choices)
    featured = filters.BooleanFilter()
    has_image = filters.BooleanFilter(method='filter_has_image')
    has_logo = filters.BooleanFilter(method='filter_has_logo')
    has_link = filters.BooleanFilter(method='filter_has_link')

    def filter_has_image(self, queryset, name, value):
        """Filter by partners with images"""
        if value:
            return queryset.exclude(partner_image__isnull=True).exclude(partner_image='')
        return queryset.filter(Q(partner_image__isnull=True) | Q(partner_image=''))

    def filter_has_logo(self, queryset, name, value):
        """Filter by partners with logos"""
        if value:
            return queryset.exclude(partner_logo__isnull=True).exclude(partner_logo='')
        return queryset.filter(Q(partner_logo__isnull=True) | Q(partner_logo=''))

    def filter_has_link(self, queryset, name, value):
        """Filter by partners with external links"""
        if value:
            return queryset.exclude(partner_link__isnull=True).exclude(partner_link='')
        return queryset.filter(Q(partner_link__isnull=True) | Q(partner_link=''))

    class Meta:
        model = Partner
        fields = {
            'partner_name': ['exact', 'icontains'],
            'type': ['exact'],
            'website_category': ['exact'],
            'featured': ['exact'],
            'order': ['exact', 'gte', 'lte'],
            'created': ['exact', 'gte', 'lte'],
            'modified': ['exact', 'gte', 'lte'],
        }


class PartnerDescriptionFilter(filters.FilterSet):
    """Filter for PartnerDescription model"""
    partner_name = filters.CharFilter(
        field_name='partner__partner_name', lookup_expr='icontains')
    description = filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = PartnerDescription
        fields = {
            'description': ['icontains'],
            'order': ['exact', 'gte', 'lte'],
            'partner': ['exact'],
        }
