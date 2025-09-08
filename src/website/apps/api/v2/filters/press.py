"""
Press app filters for v2 API
"""
import django_filters
from django.utils import timezone
from apps.press.models import Press


class PressFilterSet(django_filters.FilterSet):
    """
    Filter set for Press model with comprehensive filtering options
    """
    # Date filters
    date_published_after = django_filters.DateFilter(
        field_name='date_published', lookup_expr='gte')
    date_published_before = django_filters.DateFilter(
        field_name='date_published', lookup_expr='lte')
    published_this_year = django_filters.BooleanFilter(
        method='filter_published_this_year')
    published_this_month = django_filters.BooleanFilter(
        method='filter_published_this_month')

    # Text search filters
    title_contains = django_filters.CharFilter(
        field_name='article_title', lookup_expr='icontains')
    intro_contains = django_filters.CharFilter(
        field_name='article_intro', lookup_expr='icontains')

    # Category and tag filters
    website_category = django_filters.ChoiceFilter(
        choices=Press.WebsiteCategory.choices if hasattr(Press, 'WebsiteCategory') else [])

    # Date range filter
    date_range = django_filters.CharFilter(method='filter_date_range')

    def filter_published_this_year(self, queryset, name, value):
        """Filter articles published this year"""
        if value:
            current_year = timezone.now().year
            return queryset.filter(date_published__year=current_year)
        return queryset

    def filter_published_this_month(self, queryset, name, value):
        """Filter articles published this month"""
        if value:
            now = timezone.now()
            return queryset.filter(
                date_published__year=now.year,
                date_published__month=now.month
            )
        return queryset

    def filter_date_range(self, queryset, name, value):
        """Filter by predefined date ranges"""
        now = timezone.now()

        if value == 'this_year':
            return queryset.filter(date_published__year=now.year)
        elif value == 'last_30_days':
            thirty_days_ago = now.date() - timezone.timedelta(days=30)
            return queryset.filter(date_published__gte=thirty_days_ago)
        elif value == 'last_90_days':
            ninety_days_ago = now.date() - timezone.timedelta(days=90)
            return queryset.filter(date_published__gte=ninety_days_ago)
        elif value == 'this_month':
            return queryset.filter(
                date_published__year=now.year,
                date_published__month=now.month
            )

        return queryset

    class Meta:
        model = Press
        fields = {
            'article_title': ['exact', 'icontains'],
            'article_intro': ['icontains'],
            'date_published': ['exact', 'gte', 'lte', 'year', 'month'],
            'website_category': ['exact'],
            'order': ['exact', 'gte', 'lte'],
        }
