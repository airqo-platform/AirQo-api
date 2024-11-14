from rest_framework import serializers
from .models import AfricanCountry, City, Content, Image, Description


class ImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        request = self.context.get('request')  # Get the request context for absolute URLs
        return obj.get_image_url(request)

    class Meta:
        fields = ('id', 'image_url')
        model = Image


class DescriptionSerializer(serializers.ModelSerializer):
    class Meta:
        fields = ('id', 'paragraph')
        model = Description


class ContentSerializer(serializers.ModelSerializer):
    image = ImageSerializer(read_only=True, many=True)
    description = DescriptionSerializer(read_only=True, many=True)

    class Meta:
        fields = ('id', 'title', 'description', 'image')
        model = Content


class CitySerializer(serializers.ModelSerializer):
    content = ContentSerializer(read_only=True, many=True)

    class Meta:
        fields = ('id', 'city_name', 'content')
        model = City


class AfricanCitySerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True, many=True)
    country_flag_url = serializers.SerializerMethodField()

    def get_country_flag_url(self, obj):
        request = self.context.get('request')  # Get the request context for absolute URLs
        return obj.get_country_flag_url(request)

    class Meta:
        fields = ('id', 'country_name', 'country_flag_url', 'city')
        model = AfricanCountry
