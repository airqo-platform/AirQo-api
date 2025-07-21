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

    class Meta:
        model = Career
        fields = '__all__'
