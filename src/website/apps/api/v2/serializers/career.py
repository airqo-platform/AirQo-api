# Career app serializers
from rest_framework import serializers
from apps.career.models import Career, Department, JobDescription, BulletDescription, BulletPoint
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


class BulletPointSerializer(serializers.ModelSerializer):
    """Serializer for BulletPoint"""
    class Meta:
        model = BulletPoint
        fields = ['id', 'point', 'order', 'created', 'modified']


class BulletDescriptionSerializer(serializers.ModelSerializer):
    """Serializer for BulletDescription with nested bullet points"""
    bullet_points = BulletPointSerializer(many=True, read_only=True)

    class Meta:
        model = BulletDescription
        fields = ['id', 'name', 'order',
                  'bullet_points', 'created', 'modified']


class JobDescriptionSerializer(serializers.ModelSerializer):
    """Serializer for JobDescription"""
    class Meta:
        model = JobDescription
        fields = ['id', 'description', 'order', 'created', 'modified']


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
    descriptions = JobDescriptionSerializer(many=True, read_only=True)
    bullets = BulletDescriptionSerializer(many=True, read_only=True)
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()
    type_display = serializers.CharField(
        source='get_type_display', read_only=True)

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
        fields = [
            'public_identifier', 'title', 'unique_title', 'type', 'type_display',
            'closing_date', 'apply_url', 'department', 'descriptions', 'bullets',
            'api_url', 'has_slug', 'created', 'modified', 'is_deleted'
        ]
        ref_name = 'CareerDetailV2'
