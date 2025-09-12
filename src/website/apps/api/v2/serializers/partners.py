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

    def get_partner_image_url(self, obj):
        return obj.partner_image.url if obj.partner_image else None

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = Partner
        # Unique ref_name for v2 to avoid OpenAPI collisions with v1
        ref_name = 'PartnerListV2'
        fields = [
            'id', 'partner_name', 'partner_image_url', 'partner_logo_url',
            'partner_link', 'type', 'type_display', 'website_category',
            'website_category_display', 'order', 'created', 'modified'
        ]


class PartnerDescriptionSerializer(serializers.ModelSerializer):
    """Serializer for PartnerDescription"""

    class Meta:
        model = PartnerDescription
        fields = ['id', 'description', 'order', 'partner']
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

    def get_partner_image_url(self, obj):
        return obj.partner_image.url if obj.partner_image else None

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = Partner
        # Unique ref_name for v2 to avoid OpenAPI collisions with v1
        ref_name = 'PartnerDetailV2'
        fields = [
            'id', 'partner_name', 'partner_image', 'partner_image_url',
            'partner_logo', 'partner_logo_url', 'partner_link', 'type', 'type_display',
            'website_category', 'website_category_display', 'descriptions',
            'order', 'created', 'modified', 'is_deleted'
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
