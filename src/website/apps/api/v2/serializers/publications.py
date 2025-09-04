"""
Publications app serializers for v2 API
"""
from rest_framework import serializers
from apps.publications.models import Publication


class PublicationListSerializer(serializers.ModelSerializer):
    """List serializer for Publication - optimized for listing"""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True)
    resource_file_url = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    has_link = serializers.SerializerMethodField()

    def get_resource_file_url(self, obj):
        return obj.resource_file.url if obj.resource_file else None

    def get_has_file(self, obj):
        return bool(obj.resource_file)

    def get_has_link(self, obj):
        return bool(obj.link)

    class Meta:
        model = Publication
        # Unique ref_name for v2 to avoid OpenAPI component name collisions
        ref_name = 'PublicationListV2'
        fields = [
            'id', 'title', 'authors', 'category', 'category_display',
            'link', 'link_title', 'resource_file_url', 'has_file', 'has_link',
            'order', 'created', 'modified'
        ]


class PublicationDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for Publication with all related data"""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True)
    resource_file_url = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    has_link = serializers.SerializerMethodField()

    def get_resource_file_url(self, obj):
        return obj.resource_file.url if obj.resource_file else None

    def get_has_file(self, obj):
        return bool(obj.resource_file)

    def get_has_link(self, obj):
        return bool(obj.link)

    class Meta:
        model = Publication
        # Unique ref_name for v2 to avoid OpenAPI component name collisions
        ref_name = 'PublicationDetailV2'
        fields = [
            'id', 'title', 'authors', 'description', 'category', 'category_display',
            'link', 'link_title', 'resource_file', 'resource_file_url',
            'has_file', 'has_link', 'order', 'created', 'modified', 'is_deleted'
        ]
