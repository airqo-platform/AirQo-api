from rest_framework import serializers
from .models import Member, MemberBiography


class MemberBiographySerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberBiography
        fields = ("id", "description", "member", "order")


class TeamMemberSerializer(serializers.ModelSerializer):
    descriptions = MemberBiographySerializer(read_only=True, many=True)
    picture_url = serializers.SerializerMethodField()
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

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
            "public_identifier",
            "api_url",
            "has_slug",
        ]

    def get_picture_url(self, obj):
        """
        Get the secure URL for the member's picture.
        """
        return obj.get_picture_url()

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/team/{identifier}/"

    def get_has_slug(self, obj):
        """Return whether object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Hide ID when slug is available"""
        data = super().to_representation(instance)
        if instance.slug:
            data.pop('id', None)
        return data
