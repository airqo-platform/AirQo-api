from rest_framework import serializers
from .models import Press


class PressSerializer(serializers.ModelSerializer):
    publisher_logo_url = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    class Meta:
        model = Press
        fields = [
            "id",
            "article_title",
            "article_intro",
            "article_link",
            "date_published",
            "publisher_logo",
            "publisher_logo_url",
            "website_category",
            "article_tag",
            "order",
            "public_identifier",
            "api_url",
            "has_slug",
        ]

    def get_publisher_logo_url(self, obj):
        """
        Return the URL of the publisher logo.
        """
        if obj.publisher_logo:
            return obj.publisher_logo.url
        return None

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
