# Board app serializers
from rest_framework import serializers
from apps.board.models import BoardMember
from ..utils import DynamicFieldsSerializerMixin


class BoardMemberListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()

    def get_picture_url(self, obj):
        return obj.picture.url if obj.picture else None

    class Meta:
        model = BoardMember
        fields = ['id', 'name', 'title', 'picture_url', 'twitter',
                  'linked_in', 'order', 'created', 'modified']
    ref_name = 'BoardMemberListV2'


class BoardMemberDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()

    def get_picture_url(self, obj):
        return obj.picture.url if obj.picture else None

    class Meta:
        model = BoardMember
        fields = ['id', 'name', 'title', 'picture_url', 'twitter',
                  'linked_in', 'order', 'created', 'modified', 'is_deleted']
    ref_name = 'BoardMemberDetailV2'
