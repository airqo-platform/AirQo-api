from rest_framework import serializers
from .models import Publication
from django.conf import settings


class PublicationSerializer(serializers.ModelSerializer):
    resource_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = ['id', 'title', 'authors', 'link',
                  'resource_file_url', 'link_title', 'category', 'order']

    def get_resource_file_url(self, obj):
        """
        Handle the file URL depending on the environment.
        - Serve files locally during development.
        - Return secure Cloudinary URL in production.
        """
        if obj.resource_file:
            if settings.DEBUG:
                # In development, serve files from local storage
                request = self.context.get('request')
                if request is not None:
                    return request.build_absolute_uri(obj.resource_file.url)
            else:
                # In production, return the Cloudinary secure URL
                return obj.resource_file.url
        return None
