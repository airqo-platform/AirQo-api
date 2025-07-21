from rest_framework import serializers
from .models import Press


class PressSerializer(serializers.ModelSerializer):
    publisher_logo_url = serializers.SerializerMethodField()

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
        ]

    def get_publisher_logo_url(self, obj):
        """
        Return the URL of the publisher logo.
        """
        if obj.publisher_logo:
            return obj.publisher_logo.url
        return None
