"""
Impact app serializers for v2 API
"""
from rest_framework import serializers
from apps.impact.models import ImpactNumber
from ..utils import DynamicFieldsSerializerMixin


class ImpactNumberListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    List serializer for ImpactNumber - includes all fields as it's a single record
    """
    class Meta:
        model = ImpactNumber
        fields = [
            'id',
            'african_cities',
            'champions',
            'deployed_monitors',
            'data_records',
            'research_papers',
            'partners',
            'created',
            'modified',
        ]


class ImpactNumberDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    Detail serializer for ImpactNumber - same as list since it's a single record
    """
    class Meta:
        model = ImpactNumber
        fields = [
            'id',
            'african_cities',
            'champions',
            'deployed_monitors',
            'data_records',
            'research_papers',
            'partners',
            'created',
            'modified',
        ]
