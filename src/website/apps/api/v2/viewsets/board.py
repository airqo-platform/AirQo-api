# Board app viewsets
from rest_framework import viewsets
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.board.models import BoardMember
from ..serializers.board import BoardMemberListSerializer, BoardMemberDetailSerializer
from ..filters.board import BoardMemberFilterSet
from ..pagination import StandardPageNumberPagination
from ..utils import OptimizedQuerySetMixin


class BoardMemberViewSet(OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = BoardMember.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = BoardMemberFilterSet

    search_fields = ['name', 'title']
    ordering_fields = ['id', 'name', 'title', 'order', 'created', 'modified']
    ordering = ['order', 'name']

    # Optimization settings
    select_related_fields = []
    prefetch_related_fields = ['descriptions']

    def get_serializer_class(self):  # type: ignore[override]
        return BoardMemberListSerializer if self.action == 'list' else BoardMemberDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        if hasattr(BoardMember, 'is_deleted'):
            queryset = queryset.filter(is_deleted=False)
        return queryset
