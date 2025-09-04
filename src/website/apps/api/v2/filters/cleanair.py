"""
CleanAir app filters for v2 API
"""
import django_filters
from django.utils import timezone
from apps.cleanair.models import CleanAirResource, ForumEvent


class CleanAirResourceFilterSet(django_filters.FilterSet):
    """
    Filter set for CleanAirResource with comprehensive filtering
    """
    # Category filters
    resource_category = django_filters.ChoiceFilter()

    # Text search filters
    title_contains = django_filters.CharFilter(
        field_name='resource_title', lookup_expr='icontains')
    authors_contains = django_filters.CharFilter(
        field_name='resource_authors', lookup_expr='icontains')

    # Date filters
    created_after = django_filters.DateTimeFilter(
        field_name='created', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(
        field_name='created', lookup_expr='lte')

    # File type filter
    has_file = django_filters.BooleanFilter(method='filter_has_file')
    has_link = django_filters.BooleanFilter(method='filter_has_link')

    def filter_has_file(self, queryset, name, value):
        """Filter resources that have file attachments"""
        if value:
            return queryset.exclude(resource_file__exact='')
        return queryset.filter(resource_file__exact='')

    def filter_has_link(self, queryset, name, value):
        """Filter resources that have external links"""
        if value:
            return queryset.exclude(resource_link__exact='')
        return queryset.filter(resource_link__exact='')

    class Meta:
        model = CleanAirResource
        fields = {
            'resource_title': ['exact', 'icontains'],
            'resource_category': ['exact'],
            'resource_authors': ['icontains'],
            'author_title': ['exact', 'icontains'],
            'order': ['exact', 'gte', 'lte'],
        }


class ForumEventFilterSet(django_filters.FilterSet):
    """
    Filter set for ForumEvent with comprehensive filtering
    """
    # Date filters
    start_date_after = django_filters.DateFilter(
        field_name='start_date', lookup_expr='gte')
    start_date_before = django_filters.DateFilter(
        field_name='start_date', lookup_expr='lte')
    end_date_after = django_filters.DateFilter(
        field_name='end_date', lookup_expr='gte')
    end_date_before = django_filters.DateFilter(
        field_name='end_date', lookup_expr='lte')

    # Status filters
    event_status = django_filters.CharFilter(method='filter_event_status')
    upcoming = django_filters.BooleanFilter(method='filter_upcoming')
    past = django_filters.BooleanFilter(method='filter_past')
    ongoing = django_filters.BooleanFilter(method='filter_ongoing')

    # Text search filters
    title_contains = django_filters.CharFilter(
        field_name='title', lookup_expr='icontains')
    location_contains = django_filters.CharFilter(
        field_name='location_name', lookup_expr='icontains')

    # Date range filter
    date_range = django_filters.CharFilter(method='filter_date_range')

    def filter_event_status(self, queryset, name, value):
        """Filter by event status (upcoming, ongoing, past)"""
        now = timezone.now().date()

        if value == 'upcoming':
            return queryset.filter(start_date__gt=now)
        elif value == 'ongoing':
            return queryset.filter(start_date__lte=now, end_date__gte=now)
        elif value == 'past':
            return queryset.filter(end_date__lt=now)

        return queryset

    def filter_upcoming(self, queryset, name, value):
        """Filter upcoming events"""
        if value:
            now = timezone.now().date()
            return queryset.filter(start_date__gt=now)
        return queryset

    def filter_past(self, queryset, name, value):
        """Filter past events"""
        if value:
            now = timezone.now().date()
            return queryset.filter(end_date__lt=now)
        return queryset

    def filter_ongoing(self, queryset, name, value):
        """Filter ongoing events"""
        if value:
            now = timezone.now().date()
            return queryset.filter(start_date__lte=now, end_date__gte=now)
        return queryset

    def filter_date_range(self, queryset, name, value):
        """Filter by predefined date ranges"""
        now = timezone.now().date()

        if value == 'this_year':
            return queryset.filter(start_date__year=now.year)
        elif value == 'next_30_days':
            future_date = now + timezone.timedelta(days=30)
            return queryset.filter(start_date__gte=now, start_date__lte=future_date)
        elif value == 'this_month':
            return queryset.filter(
                start_date__year=now.year,
                start_date__month=now.month
            )

        return queryset

    class Meta:
        model = ForumEvent
        fields = {
            'title': ['exact', 'icontains'],
            'location_name': ['exact', 'icontains'],
            'start_date': ['exact', 'gte', 'lte', 'year', 'month'],
            'end_date': ['exact', 'gte', 'lte', 'year', 'month'],
            'unique_title': ['exact'],
            'order': ['exact', 'gte', 'lte'],
        }
