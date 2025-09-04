"""
Highlights app serializers for v2 API
"""
from rest_framework import serializers
from apps.highlights.models import Highlight, Tag


class TagListSerializer(serializers.ModelSerializer):
    """List serializer for Tag"""
    highlights_count = serializers.SerializerMethodField()

    def get_highlights_count(self, obj):
        return obj.highlights.count()

    class Meta:
        model = Tag
        fields = ['id', 'name', 'highlights_count', 'created', 'modified']
    ref_name = 'TagListV2'


class TagDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for Tag with related highlights"""
    highlights_count = serializers.SerializerMethodField()

    def get_highlights_count(self, obj):
        return obj.highlights.count()

    class Meta:
        model = Tag
        fields = '__all__'
    ref_name = 'TagDetailV2'


class HighlightListSerializer(serializers.ModelSerializer):
    """List serializer for Highlight - optimized for listing"""
    image_url = serializers.SerializerMethodField()
    tag_names = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        return obj.image.url if obj.image else None

    def get_tag_names(self, obj):
        return [tag.name for tag in obj.tags.all()]

    class Meta:
        model = Highlight
        fields = [
            'id', 'title', 'image_url', 'link', 'link_title',
            'tag_names', 'order', 'created', 'modified'
        ]
    ref_name = 'HighlightListV2'


class HighlightDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for Highlight with all related data"""
    image_url = serializers.SerializerMethodField()
    tags_data = TagListSerializer(source='tags', many=True, read_only=True)

    def get_image_url(self, obj):
        return obj.image.url if obj.image else None

    class Meta:
        model = Highlight
        fields = [
            'id', 'title', 'image', 'image_url', 'link', 'link_title',
            'tags', 'tags_data', 'order', 'created', 'modified', 'is_deleted'
        ]
    ref_name = 'HighlightDetailV2'
