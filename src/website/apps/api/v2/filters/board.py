# Board app filters
import django_filters
from apps.board.models import BoardMember


class BoardMemberFilterSet(django_filters.FilterSet):
    name_contains = django_filters.CharFilter(
        field_name='name', lookup_expr='icontains')
    title_contains = django_filters.CharFilter(
        field_name='title', lookup_expr='icontains')

    class Meta:
        model = BoardMember
        fields = {'name': ['exact', 'icontains'], 'title': [
            'exact', 'icontains'], 'order': ['exact', 'gte', 'lte']}
