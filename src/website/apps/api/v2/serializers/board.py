# Board app serializers
from rest_framework import serializers
from apps.board.models import BoardMember, BoardMemberBiography
from ..utils import DynamicFieldsSerializerMixin


class BoardMemberBiographySerializer(serializers.ModelSerializer):
    """Serializer for BoardMemberBiography"""

    class Meta:
        model = BoardMemberBiography
        fields = ['id', 'description', 'order', 'member']
        ref_name = 'BoardMemberBiographySerializerV2'


class BoardMemberListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()
    descriptions = BoardMemberBiographySerializer(many=True, read_only=True)

    def get_picture_url(self, obj):
        return obj.picture.url if obj.picture else None

    class Meta:
        model = BoardMember
        fields = ['id', 'name', 'title', 'picture_url', 'twitter',
                  'linked_in', 'order', 'created', 'modified', 'descriptions']
    ref_name = 'BoardMemberListV2'


class BoardMemberDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()
    descriptions = BoardMemberBiographySerializer(many=True, read_only=True)

    def get_picture_url(self, obj):
        return obj.picture.url if obj.picture else None

    class Meta:
        model = BoardMember
        fields = ['id', 'name', 'title', 'picture_url', 'twitter',
                  'linked_in', 'order', 'created', 'modified', 'is_deleted', 'descriptions']
    ref_name = 'BoardMemberDetailV2'
