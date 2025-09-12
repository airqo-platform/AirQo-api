from rest_framework import serializers
from .models import Career, Department, JobDescription, BulletDescription, BulletPoint


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name")


class JobDescriptionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobDescription
        fields = ("id", "description", "order", "career")


class BulletPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulletPoint
        fields = ("id", "point", "order")


class BulletDescriptionsSerializer(serializers.ModelSerializer):
    bullet_points = BulletPointSerializer(read_only=True, many=True)

    class Meta:
        model = BulletDescription
        fields = ("id", "name", "order", "bullet_points")


class CareerSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    descriptions = JobDescriptionsSerializer(read_only=True, many=True)
    bullets = BulletDescriptionsSerializer(read_only=True, many=True)
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    class Meta:
        model = Career
        fields = '__all__'

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
