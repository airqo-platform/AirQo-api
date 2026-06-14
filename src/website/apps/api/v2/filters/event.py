"""
Event app filters for v2 API

Special features for event app as per requirements:
- Date hierarchy filtering
- Event type and status filtering
- Virtual vs venue fields
- Side-event / main-event / parent-event filtering
"""
from django import forms
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone
import django_filters
from django_filters import rest_framework as filters

from apps.event.models import (
    Event, Inquiry, Program, Session, PartnerLogo, Resource,
    EventSideEvent,
)


def _trueish(value):
    """Parse a query-string boolean in a permissive way."""
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 't'}


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

    # ------------------------------------------------------------------------
    # Side-event / main-event filters (opt-in, non-breaking)
    # ------------------------------------------------------------------------
    # `main_events_only` and `exclude_side_events` are aliases. They
    # exclude events that are linked as a side event of some parent.
    main_events_only = filters.BooleanFilter(
        method='filter_main_events_only',
        help_text="When true, returns only top-level (non side) events.",
    )
    exclude_side_events = filters.BooleanFilter(
        method='filter_exclude_side_events',
        help_text="Alias of `main_events_only`. Excludes side events.",
    )
    is_side_event = filters.BooleanFilter(
        method='filter_is_side_event',
        help_text="When true, returns only events that are linked as side events.",
    )
    parent_event = filters.CharFilter(
        method='filter_parent_event',
        help_text="Filter side events whose parent matches the given "
                  "event id or slug.",
    )
    has_side_events = filters.BooleanFilter(
        method='filter_has_side_events',
        help_text="When true, returns only main events that have at "
                  "least one side event linked.",
    )
    organizer = filters.CharFilter(
        method='filter_organizer',
        help_text="Filter events linked to the given organizer (id, "
                  "slug, or name).",
    )

    def filter_event_status(self, queryset, name, value):
        """Filter by event status (upcoming/past/ongoing)"""
        now = timezone.now().date()

        # Treat missing end_date as single-day event (effective end_date == start_date)
        if value == 'upcoming':
            return queryset.filter(start_date__gt=now)
        elif value == 'past':
            return queryset.filter(Q(end_date__lt=now) | Q(end_date__isnull=True, start_date__lt=now))
        elif value == 'ongoing':
            return queryset.filter(start_date__lte=now).filter(Q(end_date__gte=now) | Q(end_date__isnull=True, start_date=now))

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

    # ----- Side-event / main-event / organizer filters ---------------------

    def _side_event_link_exists(self, queryset, *, on='side'):
        """Return an Exists() subquery for EventSideEvent rows on this queryset.

        `on='side'`    -> links where this event is the *side event* (parent links)
        `on='parent'`  -> links where this event is the *parent event* (side links)
        """
        if on == 'side':
            return Exists(
                EventSideEvent.objects.filter(
                    side_event=OuterRef('pk'),
                    is_deleted=False,
                )
            )
        return Exists(
            EventSideEvent.objects.filter(
                parent_event=OuterRef('pk'),
                is_deleted=False,
            )
        )

    def filter_main_events_only(self, queryset, name, value):
        if _trueish(value):
            return queryset.annotate(
                _has_parent=self._side_event_link_exists(queryset, on='side')
            ).filter(_has_parent=False)
        return queryset

    def filter_exclude_side_events(self, queryset, name, value):
        return self.filter_main_events_only(queryset, name, value)

    def filter_is_side_event(self, queryset, name, value):
        if _trueish(value):
            return queryset.annotate(
                _has_parent=self._side_event_link_exists(queryset, on='side')
            ).filter(_has_parent=True)
        return queryset.annotate(
            _has_parent=self._side_event_link_exists(queryset, on='side')
        ).filter(_has_parent=False)

    def filter_parent_event(self, queryset, name, value):
        """Filter side events whose parent_event matches the given id or slug."""
        if not value:
            return queryset
        if str(value).isdigit():
            parent_filter = Q(parent_event_links__parent_event_id=int(value))
        else:
            parent_filter = Q(parent_event_links__parent_event__slug=value)
        return queryset.filter(
            parent_event_links__is_deleted=False,
        ).filter(parent_filter).distinct()

    def filter_has_side_events(self, queryset, name, value):
        if _trueish(value):
            return queryset.annotate(
                _has_sides=self._side_event_link_exists(queryset, on='parent')
            ).filter(_has_sides=True)
        return queryset.annotate(
            _has_sides=self._side_event_link_exists(queryset, on='parent')
        ).filter(_has_sides=False)

    def filter_organizer(self, queryset, name, value):
        if not value:
            return queryset
        if str(value).isdigit():
            return queryset.filter(
                event_organizer_links__organizer_id=int(value),
                event_organizer_links__is_deleted=False,
            ).distinct()
        return queryset.filter(
            Q(event_organizer_links__organizer__slug=value) |
            Q(event_organizer_links__organizer__name__icontains=value),
            event_organizer_links__is_deleted=False,
        ).distinct()

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
