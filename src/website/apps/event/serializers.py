
from rest_framework import serializers
from .models import Event, Inquiry, Program, Session, PartnerLogo, Resource


class PartnerLogoSerializer(serializers.ModelSerializer):
    partner_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = PartnerLogo
        fields = ['name', 'partner_logo_url', 'order']

    def get_partner_logo_url(self, obj):
        if obj.partner_logo:
            return obj.partner_logo.url  # Directly use the .url attribute
        return None


class ResourceSerializer(serializers.ModelSerializer):
    resource_url = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = ['title', 'link', 'resource_url', 'order']

    def get_resource_url(self, obj):
        if obj.resource:
            return obj.resource.url  # Directly use the .url attribute
        return None


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = [
            'session_title',
            'start_time',
            'end_time',
            'venue',
            'session_details',  # Now TextField
            'order'
        ]
        ref_name = 'EventSessionSerializer'


class ProgramSerializer(serializers.ModelSerializer):
    sessions = SessionSerializer(many=True, read_only=True)

    class Meta:
        model = Program
        fields = [
            'date',
            'program_details',  # Now TextField
            'order',
            'sessions'
        ]
        ref_name = 'EventProgramSerializer'


class InquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inquiry
        fields = ['inquiry', 'role', 'email', 'order']


class EventListSerializer(serializers.ModelSerializer):
    event_tag = serializers.CharField(source='get_event_tag_display')
    event_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'title_subtext',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'event_tag',
            'event_image_url',
        ]
        ref_name = 'EventListV1'

    def get_event_image_url(self, obj):
        if obj.event_image:
            return obj.event_image.url  # Directly use the .url attribute
        return None


class EventDetailSerializer(serializers.ModelSerializer):
    event_image_url = serializers.SerializerMethodField()
    background_image_url = serializers.SerializerMethodField()
    inquiries = InquirySerializer(many=True, read_only=True)
    programs = ProgramSerializer(many=True, read_only=True)
    partner_logos = PartnerLogoSerializer(many=True, read_only=True)
    resources = ResourceSerializer(many=True, read_only=True)
    event_tag = serializers.CharField(source='get_event_tag_display')

    class Meta:
        model = Event
        fields = [
            'id',
            'title',
            'title_subtext',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'registration_link',
            'website_category',
            'event_tag',
            'event_category',
            'event_image_url',
            'background_image_url',
            'location_name',
            'location_link',
            'event_details',  # Now TextField
            'order',
            'inquiries',
            'programs',
            'partner_logos',
            'resources',
        ]
        ref_name = 'EventDetailV1'

    def get_event_image_url(self, obj):
        if obj.event_image:
            return obj.event_image.url  # Directly use the .url attribute
        return None

    def get_background_image_url(self, obj):
        if obj.background_image:
            return obj.background_image.url  # Directly use the .url attribute
        return None
