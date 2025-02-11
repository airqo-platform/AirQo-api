from rest_framework import serializers
from .models import Partner, PartnerDescription


class PartnerDescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartnerDescription
        fields = ("id", "description", "partner", "order")


class PartnerSerializer(serializers.ModelSerializer):
    descriptions = PartnerDescriptionSerializer(read_only=True, many=True)
    partner_image_url = serializers.SerializerMethodField()
    partner_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = [
            "id",
            "partner_name",
            "partner_link",
            "website_category",
            "type",
            "partner_logo_url",
            "partner_image_url",
            "descriptions",
            "order",
        ]

    def get_partner_logo_url(self, obj):
        """
        Return the secure or local URL for the partner logo.
        """
        if obj.partner_logo:
            return obj.partner_logo.url
        return None

    def get_partner_image_url(self, obj):
        """
        Return the secure or local URL for the partner image.
        """
        if obj.partner_image:
            return obj.partner_image.url
        return None
