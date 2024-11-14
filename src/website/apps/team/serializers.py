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
        fields = '__all__'

    def get_picture_url(self, obj):
        return obj.get_picture_url()  # Handles secure URL or local URL based on the environment
