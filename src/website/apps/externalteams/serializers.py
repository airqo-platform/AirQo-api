from rest_framework import serializers
from .models import ExternalTeamMember, ExternalTeamMemberBiography


class ExternalTeamMemberBiographySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalTeamMemberBiography
        fields = ['id', 'description', 'order']


class ExternalTeamMemberSerializer(serializers.ModelSerializer):
    descriptions = ExternalTeamMemberBiographySerializer(
        many=True, read_only=True)
    picture_url = serializers.SerializerMethodField()

    class Meta:
        model = ExternalTeamMember
        fields = [
            'id', 'name', 'title', 'picture_url',
            'twitter', 'linked_in', 'order', 'descriptions'
        ]

    def get_picture_url(self, obj):
        """
        Return the secure URL for the picture.
        """
        return obj.get_picture_url()  # Already handled in the model
