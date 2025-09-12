"""
Publications app serializers for v2 API with universal slug support
"""
from rest_framework import serializers
from apps.publications.models import Publication
from .mixins import ListSerializerMixin, DetailSerializerMixin


class PublicationListSerializer(ListSerializerMixin, serializers.ModelSerializer):
    """List serializer for Publication - optimized for listing with slug support"""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True)
    resource_file_url = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    has_link = serializers.SerializerMethodField()
    
    # Slug fields for privacy-friendly URLs
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_resource_file_url(self, obj):
        return obj.resource_file.url if obj.resource_file else None

    def get_has_file(self, obj):
        return bool(obj.resource_file)

    def get_has_link(self, obj):
        return bool(obj.link)

    def get_public_identifier(self, obj):
        """Get the public identifier (slug or fallback)"""
        return obj.slug if obj.slug else str(obj.id)
    
    def get_api_url(self, obj):
        """Get the API URL for the object"""
        if hasattr(obj, 'get_absolute_url'):
            return obj.get_absolute_url()
        identifier = obj.slug if obj.slug else obj.id
        return f"/website/api/v2/publications/{identifier}/"
    
    def get_has_slug(self, obj):
        """Check if object has a slug"""
        return bool(obj.slug)
    
    def to_representation(self, instance):
        """Override to conditionally hide ID for privacy"""
        data = super().to_representation(instance)
        
        # Hide ID if slug exists for privacy
        if instance.slug:
            data.pop('id', None)
        
        return data

    class Meta:
        model = Publication
        # Unique ref_name for v2 to avoid OpenAPI component name collisions
        ref_name = 'PublicationListV2'
        fields = [
            # Model fields
            'id', 'title', 'authors', 'category', 'category_display',
            'link', 'link_title', 'resource_file_url', 'has_file', 'has_link',
            'order', 'created', 'modified',
            # Slug fields (SerializerMethodFields)
            'public_identifier', 'api_url', 'has_slug'
        ]


class PublicationDetailSerializer(DetailSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Publication with all related data and slug support"""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True)
    resource_file_url = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()
    has_link = serializers.SerializerMethodField()
    
    # Slug fields for privacy-friendly URLs
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_resource_file_url(self, obj):
        return obj.resource_file.url if obj.resource_file else None

    def get_has_file(self, obj):
        return bool(obj.resource_file)

    def get_has_link(self, obj):
        return bool(obj.link)

    def get_public_identifier(self, obj):
        """Get the public identifier (slug or fallback)"""
        return obj.slug if obj.slug else str(obj.id)
    
    def get_api_url(self, obj):
        """Get the API URL for the object"""
        if hasattr(obj, 'get_absolute_url'):
            return obj.get_absolute_url()
        identifier = obj.slug if obj.slug else obj.id
        return f"/website/api/v2/publications/{identifier}/"
    
    def get_has_slug(self, obj):
        """Check if object has a slug"""
        return bool(obj.slug)
    
    def to_representation(self, instance):
        """Override to conditionally hide ID for privacy"""
        data = super().to_representation(instance)
        
        # Hide ID if slug exists for privacy
        if instance.slug:
            data.pop('id', None)
        
        return data

    class Meta:
        model = Publication
        # Unique ref_name for v2 to avoid OpenAPI component name collisions
        ref_name = 'PublicationDetailV2'
        fields = [
            # Model fields
            'id', 'title', 'authors', 'description', 'category', 'category_display',
            'link', 'link_title', 'resource_file', 'resource_file_url',
            'has_file', 'has_link', 'order', 'created', 'modified', 'is_deleted',
            # Slug fields (SerializerMethodFields)
            'public_identifier', 'api_url', 'has_slug'
        ]
