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

    class Meta:
        model = Career
        fields = ['id', 'title', 'type', 'closing_date',
                  'apply_url', 'department', 'created', 'modified']
    ref_name = 'CareerListV2'


class CareerDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    department = DepartmentDetailSerializer(read_only=True)

    class Meta:
        model = Career
        fields = '__all__'
    ref_name = 'CareerDetailV2'
