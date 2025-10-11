"""
ExternalTeams app serializers for v2 API
"""
from rest_framework import serializers
from apps.externalteams.models import ExternalTeamMember, ExternalTeamMemberBiography


class ExternalTeamMemberBiographySerializer(serializers.ModelSerializer):
    """Serializer for ExternalTeamMemberBiography"""

    class Meta:
        model = ExternalTeamMemberBiography
        fields = ['id', 'description', 'order', 'member']
        ref_name = 'ExternalTeamMemberBiographySerializerV2'


class ExternalTeamMemberListSerializer(serializers.ModelSerializer):
    """List serializer for ExternalTeamMember - optimized for listing"""
    picture_url = serializers.SerializerMethodField()

    def get_picture_url(self, obj):
        return obj.get_picture_url()

    class Meta:
        model = ExternalTeamMember
        fields = [
            'id', 'name', 'title', 'picture_url', 'twitter', 'linked_in',
            'order', 'created', 'modified'
        ]
    ref_name = 'ExternalTeamMemberListV2'


class ExternalTeamMemberDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for ExternalTeamMember with all related data"""
    picture_url = serializers.SerializerMethodField()
    descriptions = ExternalTeamMemberBiographySerializer(
        many=True, read_only=True)

    def get_picture_url(self, obj):
        return obj.get_picture_url()

    class Meta:
        model = ExternalTeamMember
        fields = [
            'id', 'name', 'title', 'picture', 'picture_url', 'twitter', 'linked_in',
            'order', 'descriptions', 'created', 'modified', 'is_deleted'
        ]
    ref_name = 'ExternalTeamMemberDetailV2'


class ExternalTeamMemberBiographyListSerializer(serializers.ModelSerializer):
    """List serializer for ExternalTeamMemberBiography"""

    class Meta:
        model = ExternalTeamMemberBiography
        fields = ['id', 'description', 'order', 'member']
    ref_name = 'ExternalTeamMemberBiographyListV2'


class ExternalTeamMemberBiographyDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for ExternalTeamMemberBiography"""

    class Meta:
        model = ExternalTeamMemberBiography
        fields = '__all__'
    ref_name = 'ExternalTeamMemberBiographyDetailV2'
