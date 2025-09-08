"""
Team app serializers for v2 API
"""
from rest_framework import serializers
from apps.team.models import Member, MemberBiography
from drf_spectacular.utils import extend_schema_field


class MemberBiographySerializer(serializers.ModelSerializer):
    """Serializer for MemberBiography"""

    class Meta:
        model = MemberBiography
        fields = ['id', 'description', 'order', 'member']
        ref_name = 'MemberBiographySerializerV2'


class MemberListSerializer(serializers.ModelSerializer):
    """List serializer for Member - optimized for listing"""
    picture_url = serializers.SerializerMethodField()

    def get_picture_url(self, obj):
        @extend_schema_field(serializers.CharField(allow_null=True))
        def inner(_):
            return None
        return obj.get_picture_url()

    class Meta:
        model = Member
        fields = [
            'id', 'name', 'title', 'about', 'picture_url', 'twitter', 'linked_in',
            'order', 'created', 'modified'
        ]
    ref_name = 'MemberListV2'


class MemberDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for Member with all related data"""
    picture_url = serializers.SerializerMethodField()
    descriptions = MemberBiographySerializer(many=True, read_only=True)

    def get_picture_url(self, obj):
        @extend_schema_field(serializers.CharField(allow_null=True))
        def inner(_):
            return None
        return obj.get_picture_url()

    class Meta:
        model = Member
        fields = [
            'id', 'name', 'title', 'about', 'picture', 'picture_url', 'twitter',
            'linked_in', 'order', 'descriptions', 'created', 'modified', 'is_deleted'
        ]
    ref_name = 'MemberDetailV2'


class MemberBiographyListSerializer(serializers.ModelSerializer):
    """List serializer for MemberBiography"""
    member_name = serializers.CharField(source='member.name', read_only=True)

    class Meta:
        model = MemberBiography
        fields = ['id', 'description', 'order', 'member', 'member_name']
        ref_name = 'MemberBiographyListSerializerV2'


class MemberBiographyDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for MemberBiography"""

    class Meta:
        model = MemberBiography
        fields = '__all__'
        ref_name = 'MemberBiographyDetailSerializerV2'
