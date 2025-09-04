"""
ExternalTeams app filters for v2 API
"""
from django.db.models import Q
import django_filters
from django_filters import rest_framework as filters
from apps.externalteams.models import ExternalTeamMember, ExternalTeamMemberBiography


class ExternalTeamMemberFilter(filters.FilterSet):
    """Filter for ExternalTeamMember model"""
    name = filters.CharFilter(lookup_expr='icontains')
    title = filters.CharFilter(lookup_expr='icontains')
    has_picture = filters.BooleanFilter(method='filter_has_picture')
    has_social_media = filters.BooleanFilter(method='filter_has_social_media')

    def filter_has_picture(self, queryset, name, value):
        """Filter by members who have profile pictures"""
        if value:
            return queryset.exclude(picture__isnull=True).exclude(picture='')
        return queryset.filter(
            Q(picture__isnull=True) | Q(picture='')
        )

    def filter_has_social_media(self, queryset, name, value):
        """Filter by members who have social media links"""
        if value:
            return queryset.filter(
                Q(twitter__isnull=False) & ~Q(twitter='') |
                Q(linked_in__isnull=False) & ~Q(linked_in='')
            )
        return queryset.filter(
            (Q(twitter__isnull=True) | Q(twitter='')) &
            (Q(linked_in__isnull=True) | Q(linked_in=''))
        )

    class Meta:
        model = ExternalTeamMember
        fields = {
            'name': ['exact', 'icontains'],
            'title': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
            'created': ['exact', 'gte', 'lte'],
            'modified': ['exact', 'gte', 'lte'],
        }


class ExternalTeamMemberBiographyFilter(filters.FilterSet):
    """Filter for ExternalTeamMemberBiography model"""
    member_name = filters.CharFilter(
        field_name='member__name', lookup_expr='icontains')
    description = filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = ExternalTeamMemberBiography
        fields = {
            'description': ['icontains'],
            'order': ['exact', 'gte', 'lte'],
            'member': ['exact'],
        }
