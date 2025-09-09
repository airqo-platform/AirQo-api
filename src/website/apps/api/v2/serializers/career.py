# Career app serializers
from rest_framework import serializers
from apps.career.models import Career, Department
from ..utils import DynamicFieldsSerializerMixin


class DepartmentListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name']
        ref_name = 'DepartmentListSerializerV2'


class DepartmentDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'created', 'modified', 'is_deleted']
        ref_name = 'DepartmentDetailSerializerV2'


class CareerListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    department = DepartmentListSerializer(read_only=True)
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/careers/{identifier}/"

    def get_has_slug(self, obj):
        """Return whether object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Hide ID when slug is available"""
        data = super().to_representation(instance)
        if instance.slug:
            data.pop('id', None)
        return data

    class Meta:
        model = Career
        fields = ['id', 'title', 'type', 'closing_date',
                  'apply_url', 'department', 'created', 'modified',
                  'public_identifier', 'api_url', 'has_slug']
    ref_name = 'CareerListV2'


class CareerDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    department = DepartmentDetailSerializer(read_only=True)
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    def get_public_identifier(self, obj):
        """Return privacy-friendly public identifier"""
        return obj.get_public_identifier()

    def get_api_url(self, obj):
        """Return API URL using slug when available"""
        identifier = obj.get_public_identifier()
        return f"/website/api/v2/careers/{identifier}/"

    def get_has_slug(self, obj):
        """Return whether object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Hide ID when slug is available"""
        data = super().to_representation(instance)
        if instance.slug:
            data.pop('id', None)
        return data

    class Meta:
        model = Career
        fields = '__all__'
    ref_name = 'CareerDetailV2'
