from rest_framework import serializers
from .models import Tag, Highlight
from django.conf import settings


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class HighlightSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(),
        many=True,
        write_only=True,
        source='tags'
    )
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Highlight
        fields = [
            'id',
            'title',
            'tags',
            'tag_ids',
            'image_url',
            'link',
            'link_title',
            'order'
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if settings.DEBUG and request:
                # Return absolute URL in local development
                return request.build_absolute_uri(obj.image.url)
            else:
                # Return secure Cloudinary URL in production
                return obj.image.url
        return None
