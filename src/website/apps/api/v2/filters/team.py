"""
Team app filters for v2 API
"""
from django.db.models import Q
import django_filters
from django_filters import rest_framework as filters
from apps.team.models import Member, MemberBiography


class MemberFilter(filters.FilterSet):
    """Filter for Member model"""
    name = filters.CharFilter(lookup_expr='icontains')
    title = filters.CharFilter(lookup_expr='icontains')
    about = filters.CharFilter(lookup_expr='icontains')
    has_picture = filters.BooleanFilter(method='filter_has_picture')
    has_social_media = filters.BooleanFilter(method='filter_has_social_media')
    has_about = filters.BooleanFilter(method='filter_has_about')

    def filter_has_picture(self, queryset, name, value):
        """Filter by members who have profile pictures"""
        if value:
            return queryset.exclude(picture__isnull=True).exclude(picture='')
        return queryset.filter(Q(picture__isnull=True) | Q(picture=''))

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

    def filter_has_about(self, queryset, name, value):
        """Filter by members who have about text"""
        if value:
            return queryset.exclude(about__isnull=True).exclude(about='')
        return queryset.filter(Q(about__isnull=True) | Q(about=''))

    class Meta:
        model = Member
        fields = {
            'name': ['exact', 'icontains'],
            'title': ['exact', 'icontains'],
            'about': ['icontains'],
            'order': ['exact', 'gte', 'lte'],
            'created': ['exact', 'gte', 'lte'],
            'modified': ['exact', 'gte', 'lte'],
        }


class MemberBiographyFilter(filters.FilterSet):
    """Filter for MemberBiography model"""
    member_name = filters.CharFilter(
        field_name='member__name', lookup_expr='icontains')
    description = filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = MemberBiography
        fields = {
            'description': ['icontains'],
            'order': ['exact', 'gte', 'lte'],
            'member': ['exact'],
        }
