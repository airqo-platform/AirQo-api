"""
Blog app viewsets for v2 API
"""
from typing import Any, ClassVar, List, Optional
from importlib import import_module

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import filters, viewsets
from rest_framework.response import Response

from apps.blog.models import BlogPost
from apps.api.v2.pagination import StandardPageNumberPagination
from apps.api.v2.utils import CachedViewSetMixin, OptimizedQuerySetMixin
from apps.api.v2.mixins import SlugModelViewSetMixin

BlogPostListSerializer = import_module(
    'apps.api.v2.serializers.blogs').BlogPostListSerializer
BlogPostDetailSerializer = import_module(
    'apps.api.v2.serializers.blogs').BlogPostDetailSerializer


@extend_schema_view(
    list=extend_schema(
        summary='List published blog posts',
        description='Returns published blog posts with optional category and ordering filters.',
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
                description='Ordering fields such as order, published_at, title, or created',
            ),
        ],
    ),
    retrieve=extend_schema(
        summary='Retrieve a blog post',
        description='Returns a single published blog post using the public identifier or legacy numeric ID.',
    ),
)
class BlogPostViewSet(SlugModelViewSetMixin, CachedViewSetMixin, OptimizedQuerySetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = BlogPost.objects.all()
    pagination_class = StandardPageNumberPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields: ClassVar[List[str]] = ['title', 'summary', 'author_name', 'meta_title']
    ordering_fields: ClassVar[List[str]] = ['published_at', 'order', 'title', 'created', 'modified']
    ordering: ClassVar[List[str]] = ['-published_at', 'order']
    list_only_fields: Optional[List[str]] = [
        'id', 'slug', 'title', 'summary', 'author_name', 'author_role', 'author_image',
        'published_at', 'meta_title', 'meta_description', 'cover_image', 'website_category',
        'order', 'created', 'modified'
    ]

    def get_serializer_class(self):
        if self.action == 'list':
            return BlogPostListSerializer
        return BlogPostDetailSerializer

    def get_queryset(self) -> Any:  # type: ignore[override]
        queryset = super().get_queryset().filter(is_deleted=False, is_published=True)
        query_params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        category = query_params.get('category', None)
        if category in ['airqo', 'cleanair']:
            queryset = queryset.filter(website_category=category)
        return queryset.order_by('order', '-published_at', '-id')

    def list(self, request, *args, **kwargs):
        query_params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        cache_key = self.get_cache_key('blog_list', query_params=query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_list)
        return response

    def retrieve(self, request, *args, **kwargs):
        identifier = str(kwargs.get('slug', ''))
        query_params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        cache_key = self.get_cache_key('blog_detail', identifier, query_params)
        cached = self.get_cached_response(cache_key)
        if cached:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        self.set_cached_response(cache_key, response.data, self.cache_timeout_detail)
        return response