"""
Press app serializers for v2 API
"""
from rest_framework import serializers
from apps.press.models import Press
from ..utils import DynamicFieldsSerializerMixin


class PressListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    List serializer for Press - optimized for listing with key fields
    """
    publisher_logo_url = serializers.SerializerMethodField()
    website_category_display = serializers.CharField(
        source='get_website_category_display', read_only=True)
    article_tag_display = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_publisher_logo_url(self, obj):
        """Return the secure URL for the publisher logo"""
        if obj.publisher_logo:
            return obj.publisher_logo.url
        return None

    def get_article_tag_display(self, obj):
        """Return the display name for article tag"""
        if hasattr(obj, 'get_article_tag_display'):
            return obj.get_article_tag_display()
        return getattr(obj, 'article_tag', None)

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/press/{identifier}/"

    def get_has_slug(self, obj):
        """Return whether object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Hide ID when slug is available"""
        data = super().to_representation(instance)
        if instance.slug:
            data.pop('id', None)
        return data

    class Meta:
        model = Press
        fields = [
            'id',
            'article_title',
            'article_intro',
            'article_link',
            'date_published',
            'publisher_logo_url',
            'website_category',
            'website_category_display',
            'article_tag',
            'article_tag_display',
            'order',
            'created',
            'modified',
            'public_identifier',
            'api_url',
            'has_slug',
        ]
    ref_name = 'PressListV2'


class PressDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    Detail serializer for Press - includes all fields
    """
    publisher_logo_url = serializers.SerializerMethodField()
    website_category_display = serializers.CharField(
        source='get_website_category_display', read_only=True)
    article_tag_display = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_publisher_logo_url(self, obj):
        """Return the secure URL for the publisher logo"""
        if obj.publisher_logo:
            return obj.publisher_logo.url
        return None

    def get_article_tag_display(self, obj):
        """Return the display name for article tag"""
        if hasattr(obj, 'get_article_tag_display'):
            return obj.get_article_tag_display()
        return getattr(obj, 'article_tag', None)

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/press/{identifier}/"

    def get_has_slug(self, obj):
        """Return whether object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Hide ID when slug is available"""
        data = super().to_representation(instance)
        if instance.slug:
            data.pop('id', None)
        return data

    class Meta:
        model = Press
        fields = [
            'id',
            'article_title',
            'article_intro',
            'article_link',
            'date_published',
            'publisher_logo_url',
            'website_category',
            'website_category_display',
            'article_tag',
            'article_tag_display',
            'order',
            'created',
            'modified',
            'is_deleted',
            'public_identifier',
            'api_url',
            'has_slug',
        ]
    ref_name = 'PressDetailV2'
