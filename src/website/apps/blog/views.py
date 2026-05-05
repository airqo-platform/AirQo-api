from rest_framework import viewsets
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema_view, extend_schema

from apps.api.v2.mixins import SlugModelViewSetMixin
from apps.api.v2.pagination import StandardPageNumberPagination

from .models import BlogPost
from .serializers import BlogPostDetailSerializer, BlogPostListSerializer


@extend_schema_view(
    list=extend_schema(
        summary='List published blog posts',
        description='Returns published blog posts for the public website, ordered by manual order and publish date.',
        parameters=[
            OpenApiParameter(
                name='category',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Filter by website category (airqo or cleanair)',
            ),
            OpenApiParameter(
                name='ordering',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Ordering fields such as order, published_at, or title',
            ),
        ],
    ),
    retrieve=extend_schema(
        summary='Retrieve a blog post',
        description='Returns a single published blog post using the public identifier or legacy numeric ID.',
    ),
)
class BlogPostViewSet(SlugModelViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = BlogPost.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    pagination_class = StandardPageNumberPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ['order', 'published_at', 'title', 'created']
    ordering = ['order', '-published_at', '-id']

    def get_serializer_class(self):
        if self.action == 'list':
            return BlogPostListSerializer
        return BlogPostDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset().filter(is_deleted=False, is_published=True)
        query_params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        category = query_params.get('category', None)
        if category in ['airqo', 'cleanair']:
            queryset = queryset.filter(website_category=category)
        return queryset.order_by('order', '-published_at', '-id')