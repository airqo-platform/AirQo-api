"""
Event app filters for v2 API

Special features for event app as per requirements:
- Date hierarchy filtering
- Event type and status filtering
- Virtual vs venue fields
"""
from django import forms
from django.db.models import Q
from django.utils import timezone
import django_filters
from django_filters import rest_framework as filters

from apps.event.models import Event, Inquiry, Program, Session, PartnerLogo, Resource


class EventFilter(filters.FilterSet):
    """Comprehensive filtering for Event model"""

    # Date-based filters (special requirement for event app)
    date_from = filters.DateFilter(field_name='start_date', lookup_expr='gte')
    date_to = filters.DateFilter(field_name='end_date', lookup_expr='lte')
    start_year = filters.NumberFilter(field_name='start_date__year')
    start_month = filters.NumberFilter(field_name='start_date__month')
    start_day = filters.NumberFilter(field_name='start_date__day')

    # Event status filters (upcoming/past as specified)
    event_status = filters.ChoiceFilter(
        method='filter_event_status',
        choices=[
            ('upcoming', 'Upcoming Events'),
            ('past', 'Past Events'),
            ('ongoing', 'Ongoing Events'),
        ]
    )

    # Virtual vs venue filters (special requirement)
    is_virtual = filters.BooleanFilter(method='filter_is_virtual')
    has_venue = filters.BooleanFilter(method='filter_has_venue')

    # Event tag and type filtering
    event_tag = filters.CharFilter(lookup_expr='iexact')

    # Location-based filtering
    location_name = filters.CharFilter(lookup_expr='icontains')

    # Title/content search
    title = filters.CharFilter(lookup_expr='icontains')

    def filter_event_status(self, queryset, name, value):
        """Filter by event status (upcoming/past/ongoing)"""
        now = timezone.now().date()

        if value == 'upcoming':
            return queryset.filter(start_date__gt=now)
        elif value == 'past':
            return queryset.filter(end_date__lt=now)
        elif value == 'ongoing':
            return queryset.filter(start_date__lte=now, end_date__gte=now)

        return queryset

    def filter_is_virtual(self, queryset, name, value):
        """Filter by virtual events"""
        virtual_keywords = ['virtual', 'online', 'zoom', 'teams', 'meet']

        if value:
            # Include events with virtual keywords in location
            q_objects = Q()
            for keyword in virtual_keywords:
                q_objects |= Q(location_name__icontains=keyword)
            return queryset.filter(q_objects)
        else:
            # Exclude events with virtual keywords
            q_objects = Q()
            for keyword in virtual_keywords:
                q_objects |= Q(location_name__icontains=keyword)
            return queryset.exclude(q_objects)

    def filter_has_venue(self, queryset, name, value):
        """Filter by events with physical venue"""
        if value:
            return queryset.exclude(location_name__isnull=True).exclude(location_name='')
        else:
            return queryset.filter(
                Q(location_name__isnull=True) |
                Q(location_name='')
            )

    class Meta:
        model = Event
        fields = {
            'event_tag': ['exact', 'iexact'],
            'start_date': ['exact', 'gte', 'lte'],
            'end_date': ['exact', 'gte', 'lte'],
            'location_name': ['exact', 'icontains'],
            'title': ['icontains'],
            'order': ['exact', 'gte', 'lte'],
        }


class InquiryFilter(filters.FilterSet):
    """Filter for Inquiry model"""
    role = filters.CharFilter(lookup_expr='icontains')
    email = filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = Inquiry
        fields = {
            'role': ['exact', 'icontains'],
            'email': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
        }


class ProgramFilter(filters.FilterSet):
    """Filter for Program model"""
    date = filters.DateFilter()
    date_from = filters.DateFilter(field_name='date', lookup_expr='gte')
    date_to = filters.DateFilter(field_name='date', lookup_expr='lte')

    class Meta:
        model = Program
        fields = {
            'date': ['exact', 'gte', 'lte'],
            'order': ['exact', 'gte', 'lte'],
        }


class SessionFilter(filters.FilterSet):
    """Filter for Session model"""
    venue = filters.CharFilter(lookup_expr='icontains')
    session_title = filters.CharFilter(lookup_expr='icontains')
    start_time_from = filters.TimeFilter(
        field_name='start_time', lookup_expr='gte')
    start_time_to = filters.TimeFilter(
        field_name='start_time', lookup_expr='lte')

    class Meta:
        model = Session
        fields = {
            'session_title': ['icontains'],
            'venue': ['exact', 'icontains'],
            'start_time': ['exact', 'gte', 'lte'],
            'end_time': ['exact', 'gte', 'lte'],
            'order': ['exact', 'gte', 'lte'],
        }


class PartnerLogoFilter(filters.FilterSet):
    """Filter for PartnerLogo model"""
    name = filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = PartnerLogo
        fields = {
            'name': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
        }


class ResourceFilter(filters.FilterSet):
    """Filter for Resource model"""
    title = filters.CharFilter(lookup_expr='icontains')
    has_file = filters.BooleanFilter(method='filter_has_file')
    has_link = filters.BooleanFilter(method='filter_has_link')

    def filter_has_file(self, queryset, name, value):
        if value:
            return queryset.exclude(resource__isnull=True).exclude(resource='')
        return queryset.filter(
            Q(resource__isnull=True) |
            Q(resource='')
        )

    def filter_has_link(self, queryset, name, value):
        if value:
            return queryset.exclude(link__isnull=True).exclude(link='')
        return queryset.filter(
            Q(link__isnull=True) |
            Q(link='')
        )

    class Meta:
        model = Resource
        fields = {
            'title': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
        }
