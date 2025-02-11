from rest_framework import serializers
from .models import Member, MemberBiography


class MemberBiographySerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberBiography
        fields = ("id", "description", "member", "order")


class TeamMemberSerializer(serializers.ModelSerializer):
    descriptions = MemberBiographySerializer(read_only=True, many=True)
    picture_url = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            "id",
            "name",
            "title",
            "about",
            "picture_url",
            "twitter",
            "linked_in",
            "order",
            "descriptions",
        ]

    def get_picture_url(self, obj):
        """
        Get the secure URL for the member's picture.
        """
        return obj.get_picture_url()
