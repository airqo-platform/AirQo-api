from rest_framework import serializers
from .models import Tag, Highlight


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
        """
        Return the secure URL for the image.
        """
        if obj.image:
            return obj.image.url  # CloudinaryField provides secure URLs
        return None
