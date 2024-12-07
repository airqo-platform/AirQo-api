from rest_framework import serializers
from .models import BoardMember, BoardMemberBiography


class BoardMemberBiographySerializer(serializers.ModelSerializer):
    class Meta:
        fields = ("id", "description", "member", "order")
        model = BoardMemberBiography


class BoardMemberSerializer(serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()
    descriptions = BoardMemberBiographySerializer(read_only=True, many=True)

    class Meta:
        model = BoardMember
        fields = '__all__'

    def get_picture_url(self, obj):
        if obj.picture:
            return obj.picture.url  # Cloudinary automatically provides the correct URL
        return None
