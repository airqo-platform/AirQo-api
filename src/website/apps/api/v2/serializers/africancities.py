"""
African Cities app serializers for v2 API

Complete nested serializers to return all data as shown in the example:
- Country with flag URL
- Cities with all content
- Content with title, descriptions, and images
"""
from rest_framework import serializers
from apps.africancities.models import AfricanCountry, City, Content, Description, Image
from ..utils import DynamicFieldsSerializerMixin
from drf_spectacular.utils import extend_schema_field


class ImageSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Serializer for Image model"""
    image_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_image_url(self, obj):
        if hasattr(obj, 'get_image_url'):
            return obj.get_image_url()
        elif obj.image:
            return obj.image.url if hasattr(obj.image, 'url') else str(obj.image)
        return None

    class Meta:
        model = Image
        fields = ['id', 'image_url', 'order']
        ref_name = 'AfricanCityImageV2'


class DescriptionSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Serializer for Description model"""
    class Meta:
        model = Description
        fields = ['id', 'paragraph', 'order']
        ref_name = 'AfricanCityDescriptionV2'


class ContentSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Serializer for Content model with nested descriptions and images"""
    description = DescriptionSerializer(many=True, read_only=True)
    image = ImageSerializer(many=True, read_only=True)

    class Meta:
        model = Content
        fields = ['id', 'title', 'order', 'description', 'image']
        ref_name = 'AfricanCityContentV2'


class CitySerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Serializer for City model with nested content"""
    content = ContentSerializer(many=True, read_only=True)

    class Meta:
        model = City
        fields = ['id', 'city_name', 'order', 'content']
        ref_name = 'AfricanCityV2'


class AfricanCountryListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for AfricanCountry"""
    country_flag_url = serializers.SerializerMethodField()
    cities_count = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_country_flag_url(self, obj):
        if hasattr(obj, 'get_country_flag_url'):
            return obj.get_country_flag_url()
        elif obj.country_flag:
            return obj.country_flag.url if hasattr(obj.country_flag, 'url') else str(obj.country_flag)
        return None

    @extend_schema_field(serializers.IntegerField())
    def get_cities_count(self, obj):
        if hasattr(obj, 'city') and hasattr(obj.city, 'count'):
            return obj.city.count()
        return 0

    class Meta:
        model = AfricanCountry
        fields = ['id', 'country_name', 'country_flag_url',
                  'cities_count', 'order', 'created', 'modified']
        ref_name = 'AfricanCountryListV2'


class AfricanCountryDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for AfricanCountry with ALL nested data"""
    country_flag_url = serializers.SerializerMethodField()
    # Complete nested city data
    city = CitySerializer(many=True, read_only=True)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_country_flag_url(self, obj):
        if hasattr(obj, 'get_country_flag_url'):
            return obj.get_country_flag_url()
        elif obj.country_flag:
            return obj.country_flag.url if hasattr(obj.country_flag, 'url') else str(obj.country_flag)
        return None

    class Meta:
        model = AfricanCountry
        fields = ['id', 'country_name', 'country_flag_url',
                  'city', 'order', 'created', 'modified']
        ref_name = 'AfricanCountryDetailV2'
