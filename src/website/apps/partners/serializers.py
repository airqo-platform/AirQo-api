from rest_framework import serializers
from .models import Partner, PartnerDescription


class PartnerDescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerDescription
        fields = ("id", "description", "partner", "order")


class PartnerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list endpoints"""
    partner_logo_url = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = [
            "public_identifier",
            "partner_name",
            "partner_link",
            "website_category",
            "type",
            "partner_logo_url",
            "order",
            "featured",
            "api_url",
            "has_slug"
        ]

    def get_partner_logo_url(self, obj):
        """Return the secure or local URL for the partner logo."""
        if obj.partner_logo:
            return obj.partner_logo.url
        return None

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


class PartnerDetailSerializer(serializers.ModelSerializer):
    """Full serializer for detail endpoints"""
    descriptions = PartnerDescriptionSerializer(read_only=True, many=True)
    partner_image_url = serializers.SerializerMethodField()
    partner_logo_url = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = [
            "public_identifier",
            "partner_name",
            "partner_link",
            "website_category",
            "type",
            "partner_logo_url",
            "partner_image_url",
            "descriptions",
            "order",
            "featured",
            "api_url",
            "has_slug"
        ]

    def get_partner_logo_url(self, obj):
        """Return the secure or local URL for the partner logo."""
        if obj.partner_logo:
            return obj.partner_logo.url
        return None

    def get_partner_image_url(self, obj):
        """Return the secure or local URL for the partner image."""
        if obj.partner_image:
            return obj.partner_image.url
        return None

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


# Maintain backward compatibility with the old serializer name
PartnerSerializer = PartnerDetailSerializer
