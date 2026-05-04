"""
Blog app serializers for v2 API
"""
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.blog.models import BlogPost
from ..utils import DynamicFieldsSerializerMixin, SanitizedHTMLField


class BlogPostBaseSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    author_image_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_author_image_url(self, obj):
        if obj.author_image:
            return obj.author_image.url
        return None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_cover_image_url(self, obj):
        if obj.cover_image:
            return obj.cover_image.url
        return None

    def get_public_identifier(self, obj):
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/blogs/{identifier}/"

    def get_has_slug(self, obj):
        return bool(obj.slug)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.slug:
            data.pop('id', None)
        return data


class BlogPostListSerializer(BlogPostBaseSerializer):
    class Meta:
        model = BlogPost
        fields = [
            'id',
            'title',
            'summary',
            'author_name',
            'author_role',
            'author_image_url',
            'published_at',
            'meta_title',
            'meta_description',
            'cover_image_url',
            'website_category',
            'order',
            'created',
            'modified',
            'public_identifier',
            'api_url',
            'has_slug',
        ]
        ref_name = 'BlogPostListV2'


class BlogPostDetailSerializer(BlogPostBaseSerializer):
    content_html = SanitizedHTMLField(source='content', read_only=True)

    class Meta:
        model = BlogPost
        fields = [
            'id',
            'title',
            'summary',
            'author_name',
            'author_role',
            'author_image_url',
            'published_at',
            'meta_title',
            'meta_description',
            'cover_image_url',
            'website_category',
            'order',
            'content_html',
            'created',
            'modified',
            'is_deleted',
            'public_identifier',
            'api_url',
            'has_slug',
        ]
        ref_name = 'BlogPostDetailV2'