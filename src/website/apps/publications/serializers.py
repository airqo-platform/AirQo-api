from rest_framework import serializers
from .models import Publication


class PublicationSerializer(serializers.ModelSerializer):
    resource_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Publication
        fields = [
            "id",
            "title",
            "authors",
            "link",
            "resource_file_url",
            "link_title",
            "category",
            "order",
        ]

    def get_resource_file_url(self, obj):
        """
        Handle the file URL for the resource_file field.
        """
        if obj.resource_file:
            return obj.resource_file.url
        return None
