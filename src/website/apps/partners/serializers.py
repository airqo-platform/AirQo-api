from rest_framework import serializers
from .models import Partner, PartnerDescription
from django.conf import settings  # For checking the environment


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
            'id',
            'partner_name',
            'partner_link',
            'website_category',
            'type',
            'partner_logo_url',
            'partner_image_url',
            'descriptions',
            'order'
        ]

    def get_partner_logo_url(self, obj):
        if obj.partner_logo:
            if settings.DEBUG:
                # Return the full URL in development
                request = self.context.get('request')
                return request.build_absolute_uri(obj.partner_logo.url) if request else obj.partner_logo.url
            else:
                # Return Cloudinary URL in production
                return obj.partner_logo.url  # Cloudinary already returns a secure URL
        return None

    def get_partner_image_url(self, obj):
        if obj.partner_image:
            if settings.DEBUG:
                # Return the full URL in development
                request = self.context.get('request')
                return request.build_absolute_uri(obj.partner_image.url) if request else obj.partner_image.url
            else:
                # Return Cloudinary URL in production
                return obj.partner_image.url  # Cloudinary already returns a secure URL
        return None
