# serializers.py

from django.conf import settings
from rest_framework import serializers
from cloudinary.utils import cloudinary_url
from .models import (
    CleanAirResource, ForumEvent, Engagement, Partner, Program,
    Session, Support, Person, Objective, ForumResource,
    ResourceFile, ResourceSession
)


class CleanAirResourceSerializer(serializers.ModelSerializer):
    resource_file_url = serializers.SerializerMethodField()

    def get_resource_file_url(self, obj):
        if obj.resource_file:
            return obj.resource_file.url
        return None

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
    partner_logo_url = serializers.SerializerMethodField()

    def get_partner_logo_url(self, obj):
        if obj.partner_logo:
            return obj.partner_logo.url
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
    picture_url = serializers.SerializerMethodField()

    def get_picture_url(self, obj):
        if obj.picture:
            return obj.picture.url
        return None

    class Meta:
        model = Person
        exclude = ['order']


class ResourceFileSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

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
    engagement = EngagementSerializer(read_only=True)
    partners = PartnerSerializer(many=True, read_only=True)
    supports = SupportSerializer(many=True, read_only=True)
    programs = CleanAirProgramSerializer(many=True, read_only=True)
    persons = PersonSerializer(many=True, read_only=True)
    background_image_url = serializers.SerializerMethodField()

    def get_background_image_url(self, obj):
        if obj.background_image:
            return obj.background_image.url
        return None

    class Meta:
        model = ForumEvent
        exclude = ['order']
