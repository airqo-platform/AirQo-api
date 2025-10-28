"""
Partners app serializers for v2 API
"""
from rest_framework import serializers
from apps.partners.models import Partner, PartnerDescription


class PartnerListSerializer(serializers.ModelSerializer):
    """List serializer for Partner - optimized for listing"""
    partner_image_url = serializers.SerializerMethodField()
    partner_logo_url = serializers.SerializerMethodField()
    type_display = serializers.CharField(
        source='get_type_display', read_only=True)
    website_category_display = serializers.CharField(
        source='get_website_category_display', read_only=True)
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_partner_image_url(self, obj):
        return obj.partner_image.url if obj.partner_image else None

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/partners/{identifier}/"

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
        model = Partner
        # Unique ref_name for v2 to avoid OpenAPI collisions with v1
        ref_name = 'PartnerListV2'
        fields = [
            'public_identifier', 'partner_name', 'partner_image_url', 'partner_logo_url',
            'partner_link', 'type', 'type_display', 'website_category',
            'website_category_display', 'order', 'featured', 'api_url', 'has_slug', 'created', 'modified'
        ]


class PartnerDescriptionSerializer(serializers.ModelSerializer):
    """Serializer for PartnerDescription"""

    class Meta:
        model = PartnerDescription
        fields = ['id', 'description', 'order', 'created', 'modified']
        ref_name = 'PartnerDescriptionSerializerV2'


class PartnerDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for Partner with all related data"""
    partner_image_url = serializers.SerializerMethodField()
    partner_logo_url = serializers.SerializerMethodField()
    type_display = serializers.CharField(
        source='get_type_display', read_only=True)
    website_category_display = serializers.CharField(
        source='get_website_category_display', read_only=True)
    descriptions = PartnerDescriptionSerializer(many=True, read_only=True)
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_partner_image_url(self, obj):
        return obj.partner_image.url if obj.partner_image else None

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/partners/{identifier}/"

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
        model = Partner
        # Unique ref_name for v2 to avoid OpenAPI collisions with v1
        ref_name = 'PartnerDetailV2'
        fields = [
            'public_identifier', 'partner_name', 'partner_image', 'partner_image_url',
            'partner_logo', 'partner_logo_url', 'partner_link', 'type', 'type_display',
            'website_category', 'website_category_display', 'descriptions',
            'order', 'featured', 'api_url', 'has_slug', 'created', 'modified', 'is_deleted'
        ]


class PartnerDescriptionListSerializer(serializers.ModelSerializer):
    """List serializer for PartnerDescription"""
    partner_name = serializers.CharField(
        source='partner.partner_name', read_only=True)

    class Meta:
        model = PartnerDescription
        # Unique ref_name for v2 PartnerDescription list
        ref_name = 'PartnerDescriptionListV2'
        fields = ['id', 'description', 'order', 'partner', 'partner_name']


class PartnerDescriptionDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for PartnerDescription"""

    class Meta:
        model = PartnerDescription
        # Unique ref_name for v2 PartnerDescription detail
        ref_name = 'PartnerDescriptionDetailV2'
        fields = '__all__'
