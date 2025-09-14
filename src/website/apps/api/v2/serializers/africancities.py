"""
African Cities app serializers for v2 API
"""
from rest_framework import serializers
from apps.africancities.models import AfricanCountry
from ..utils import DynamicFieldsSerializerMixin
from drf_spectacular.utils import extend_schema_field


class AfricanCountryListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for AfricanCountry"""
    country_flag_url = serializers.SerializerMethodField()

    def get_country_flag_url(self, obj):
        # doc: returns a string URL or None
        @extend_schema_field(serializers.CharField(allow_null=True))
        def inner(_):
            return None
        if hasattr(obj, 'get_country_flag_url'):
            return obj.get_country_flag_url()
        elif obj.country_flag:
            return obj.country_flag.url if hasattr(obj.country_flag, 'url') else str(obj.country_flag)
        return None

    class Meta:
        model = AfricanCountry
        fields = ['id', 'country_name', 'country_flag_url',
                  'order', 'created', 'modified']
    ref_name = 'AfricanCountryListV2'


class AfricanCountryDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for AfricanCountry with related cities"""
    country_flag_url = serializers.SerializerMethodField()
    cities = serializers.SerializerMethodField()

    def get_country_flag_url(self, obj):
        # doc: returns a string URL or None
        @extend_schema_field(serializers.CharField(allow_null=True))
        def inner(_):
            return None
        if hasattr(obj, 'get_country_flag_url'):
            return obj.get_country_flag_url()
        elif obj.country_flag:
            return obj.country_flag.url if hasattr(obj.country_flag, 'url') else str(obj.country_flag)
        return None

    def get_cities(self, obj):
        # Get related cities if available
        if hasattr(obj, 'city') and hasattr(obj.city, 'all'):
            return obj.city.all().count()
        return 0

    class Meta:
        model = AfricanCountry
        fields = ['id', 'country_name', 'country_flag_url',
                  'cities', 'order', 'created', 'modified', 'is_deleted']
    ref_name = 'AfricanCountryDetailV2'
