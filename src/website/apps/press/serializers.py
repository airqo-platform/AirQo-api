from rest_framework import serializers
from .models import Press
from django.conf import settings  # To check the environment

class PressSerializer(serializers.ModelSerializer):
    publisher_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Press
        fields = [
            'id',
            'article_title',
            'article_intro',
            'article_link',
            'date_published',
            'publisher_logo',
            'publisher_logo_url',  # Include the generated logo URL
            'website_category',
            'article_tag',
            'order',
        ]

    def get_publisher_logo_url(self, obj):
        """
        Return the full URL for the publisher_logo, depending on the environment.
        """
        if obj.publisher_logo:
            request = self.context.get('request')
            if settings.DEBUG:  # In development mode, serve files locally
                if request is not None:
                    return request.build_absolute_uri(obj.publisher_logo.url)
            else:  # In production mode, use the secure Cloudinary URL
                return obj.publisher_logo.url  # This will return the Cloudinary URL
        return None
