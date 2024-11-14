from django.conf import settings
from rest_framework import serializers
from cloudinary.utils import cloudinary_url
from .models import (
    CleanAirResource, ForumEvent, Engagement, Partner, Program,
    Session, Support, Person, Objective, ForumResource,
    ResourceFile, ResourceSession
)


class CleanAirResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CleanAirResource
        fields = '__all__'


class ObjectiveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Objective
        exclude = ['order']


class EngagementSerializer(serializers.ModelSerializer):
    objectives = ObjectiveSerializer(many=True, read_only=True)

    class Meta:
        model = Engagement
        fields = '__all__'


class PartnerSerializer(serializers.ModelSerializer):
    partner_logo = serializers.SerializerMethodField()

    def get_partner_logo(self, obj):
        if obj.partner_logo:
            if not settings.DEBUG:
                return cloudinary_url(obj.partner_logo.public_id, secure=True)[0]
            else:
                return self.context['request'].build_absolute_uri(obj.partner_logo.url)
        return None

    class Meta:
        model = Partner
        exclude = ['order']
        ref_name = 'CleanAirPartner'


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        exclude = ['order']


class CleanAirProgramSerializer(serializers.ModelSerializer):
    sessions = SessionSerializer(many=True, read_only=True)

    class Meta:
        model = Program
        exclude = ['order']
        ref_name = 'CleanAirProgram'


class SupportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Support
        exclude = ['order']


class PersonSerializer(serializers.ModelSerializer):
    picture = serializers.SerializerMethodField()

    def get_picture(self, obj):
        if obj.picture:
            if not settings.DEBUG:
                return cloudinary_url(obj.picture.public_id, secure=True)[0]
            else:
                return self.context['request'].build_absolute_uri(obj.picture.url)
        return None

    class Meta:
        model = Person
        exclude = ['order']


class ResourceFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        file_url = obj.file.url

        # If the file is stored in Cloudinary, return the Cloudinary URL
        if hasattr(obj.file, 'public_id'):
            return cloudinary_url(obj.file.public_id, secure=not settings.DEBUG)[0]

        # For all other URLs, return the stored URL as is
        if file_url.startswith('http'):
            return file_url

        # Otherwise, assume it's a local file and construct the absolute URL
        return self.context['request'].build_absolute_uri(file_url)

    class Meta:
        model = ResourceFile
        fields = ['file_url', 'resource_summary', 'session']


class ResourceSessionSerializer(serializers.ModelSerializer):
    resource_files = ResourceFileSerializer(many=True, read_only=True)

    class Meta:
        model = ResourceSession
        fields = '__all__'


class ForumResourceSerializer(serializers.ModelSerializer):
    resource_sessions = ResourceSessionSerializer(many=True, read_only=True)

    class Meta:
        model = ForumResource
        fields = '__all__'


class ForumEventSerializer(serializers.ModelSerializer):
    forum_resources = ForumResourceSerializer(many=True, read_only=True)
    engagements = EngagementSerializer(read_only=True)
    partners = PartnerSerializer(many=True, read_only=True)
    supports = SupportSerializer(many=True, read_only=True)
    programs = CleanAirProgramSerializer(many=True, read_only=True)
    persons = PersonSerializer(many=True, read_only=True)
    background_image = serializers.SerializerMethodField()

    def get_background_image(self, obj):
        if obj.background_image:
            if not settings.DEBUG:
                return cloudinary_url(obj.background_image.public_id, secure=True)[0]
            else:
                return self.context['request'].build_absolute_uri(obj.background_image.url)
        return None

    class Meta:
        model = ForumEvent
        exclude = ['order']
