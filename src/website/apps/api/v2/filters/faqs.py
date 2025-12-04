"""
FAQs app filters for v2 API
"""
import django_filters
from apps.faqs.models import FAQ


class FAQFilterSet(django_filters.FilterSet):
    """
    Filter set for FAQ model
    """
    # Boolean filters
    is_active = django_filters.BooleanFilter()

    # Date range filters
    created_after = django_filters.DateTimeFilter(
        field_name='created_at', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(
        field_name='created_at', lookup_expr='lte')
    updated_after = django_filters.DateTimeFilter(
        field_name='updated_at', lookup_expr='gte')
    updated_before = django_filters.DateTimeFilter(
        field_name='updated_at', lookup_expr='lte')

    # Text search filters
    question_contains = django_filters.CharFilter(
        field_name='question', lookup_expr='icontains')
    answer_contains = django_filters.CharFilter(
        field_name='answer', lookup_expr='icontains')

    class Meta:
        model = FAQ
        fields = {
            'question': ['exact', 'icontains'],
            'answer': ['icontains'],
            'category': ['exact'],
            'is_active': ['exact'],
            'created_at': ['exact', 'gte', 'lte'],
            'updated_at': ['exact', 'gte', 'lte'],
        }
