# serializers.py

from rest_framework import serializers
from .models import (
    CleanAirResource, ForumEvent, Engagement, Partner, Program,
    Session, Support, Person, Objective, ForumResource,
    ResourceFile, ResourceSession, Section
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


class SectionSerializer(serializers.ModelSerializer):
    forum_events = serializers.PrimaryKeyRelatedField(
        queryset=ForumEvent.objects.all(),
        many=True
    )

    class Meta:
        model = Section
        fields = [
            'id',
            'forum_events',
            'title',
            'content',
            'section_type',
            'reverse_order',
            'pages',
            'order',
        ]


class ForumEventTitleSerializer(serializers.ModelSerializer):
    background_image_url = serializers.SerializerMethodField()

    def get_background_image_url(self, obj):
        if obj.background_image:
            return obj.background_image.url
        return ""

    class Meta:
        model = ForumEvent
        fields = [
            'id',
            'title',
            'unique_title',
            'background_image_url',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'location_name',
        ]


class ForumEventSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)
    forum_resources = ForumResourceSerializer(many=True, read_only=True)
    engagement = EngagementSerializer(read_only=True)
    # Replace the default partners field with a SerializerMethodField.
    partners = serializers.SerializerMethodField()
    supports = SupportSerializer(many=True, read_only=True)
    programs = CleanAirProgramSerializer(many=True, read_only=True)
    persons = serializers.SerializerMethodField()
    background_image_url = serializers.SerializerMethodField()

    def get_background_image_url(self, obj):
        if obj.background_image:
            return obj.background_image.url
        return None

    def get_persons(self, obj):
        """
        Return all Person objects that are explicitly linked to this event plus
        any Person with no assigned forum_events (interpreted as belonging to all events).
        """
        explicit_persons = obj.persons.all()
        unassigned_persons = Person.objects.filter(forum_events__isnull=True)
        combined = (explicit_persons | unassigned_persons).distinct()
        return PersonSerializer(combined, many=True).data

    def get_partners(self, obj):
        """
        Return all Partner objects that are explicitly linked to this event plus
        any Partner with no assigned forum_events (interpreted as belonging to all events).
        """
        explicit_partners = obj.partners.all()
        unassigned_partners = Partner.objects.filter(forum_events__isnull=True)
        combined = (explicit_partners | unassigned_partners).distinct()
        return PartnerSerializer(combined, many=True).data

    class Meta:
        model = ForumEvent
        exclude = ['order']
