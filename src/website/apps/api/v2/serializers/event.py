"""
Event app serializers for v2 API

Special features for event app as per requirements:
- Date hierarchy
- Event type filtering 
- Virtual vs venue fields
- Registration counts
- Calendar-friendly fields
"""
from rest_framework import serializers
from apps.event.models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from ..utils import DynamicFieldsSerializerMixin
from drf_spectacular.utils import extend_schema_field


class EventListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for Event - optimized for listing"""
    event_tag_display = serializers.CharField(
        source='get_event_tag_display', read_only=True)
    event_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    is_virtual = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_event_image_url(self, obj):
        return obj.event_image.url if obj.event_image else None

    @extend_schema_field(serializers.CharField())
    def get_event_status(self, obj):
        from django.utils import timezone
        now = timezone.now().date()
        if obj.end_date and obj.end_date < now:
            return 'past'
        elif obj.start_date > now:
            return 'upcoming'
        return 'ongoing'

    @extend_schema_field(serializers.BooleanField())
    def get_is_virtual(self, obj):
        # Check if location indicates virtual event. Guard against None.
        location = getattr(obj, 'location_name', None)
        if not location:
            return False
        location_text = str(location).lower()
        return 'virtual' in location_text or 'online' in location_text or 'zoom' in location_text

    class Meta:
        model = Event
        fields = [
            'id', 'title', 'title_subtext', 'start_date', 'end_date',
            'start_time', 'end_time', 'event_tag', 'event_tag_display',
            'event_image_url', 'location_name', 'event_status', 'is_virtual',
            'registration_link', 'order', 'created', 'modified'
        ]
        ref_name = 'EventListV2'


class EventDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Event with all related data"""
    event_tag_display = serializers.CharField(
        source='get_event_tag_display', read_only=True)
    event_image_url = serializers.SerializerMethodField()
    background_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    is_virtual = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_event_image_url(self, obj):
        return obj.event_image.url if obj.event_image else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_background_image_url(self, obj):
        return obj.background_image.url if obj.background_image else None

    @extend_schema_field(serializers.CharField())
    def get_event_status(self, obj):
        from django.utils import timezone
        now = timezone.now().date()
        if obj.end_date and obj.end_date < now:
            return 'past'
        elif obj.start_date > now:
            return 'upcoming'
        return 'ongoing'

    @extend_schema_field(serializers.BooleanField())
    def get_is_virtual(self, obj):
        location = getattr(obj, 'location_name', None)
        if not location:
            return False
        location_text = str(location).lower()
        return 'virtual' in location_text or 'online' in location_text or 'zoom' in location_text

    class Meta:
        model = Event
        fields = '__all__'
        ref_name = 'EventDetailV2'


# Placeholder serializers for related models
class InquiryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Inquiry
        fields = ['id', 'inquiry', 'role', 'email', 'order']
        ref_name = 'InquiryListV2'


class InquiryDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Inquiry
        fields = '__all__'
        ref_name = 'InquiryDetailV2'


class ProgramListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = ['id', 'date', 'program_details', 'order']
        ref_name = 'ProgramListV2'


class ProgramDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Program
        fields = '__all__'
        ref_name = 'ProgramDetailV2'


class SessionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ['id', 'session_title', 'start_time',
                  'end_time', 'venue', 'order']
        ref_name = 'SessionListV2'


class SessionDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = '__all__'
        ref_name = 'SessionDetailV2'


class PartnerLogoListSerializer(serializers.ModelSerializer):
    partner_logo_url = serializers.SerializerMethodField()

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = PartnerLogo
        fields = ['id', 'name', 'partner_logo_url', 'order']
        ref_name = 'PartnerLogoListV2'


class PartnerLogoDetailSerializer(serializers.ModelSerializer):
    partner_logo_url = serializers.SerializerMethodField()

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = PartnerLogo
        fields = '__all__'
        ref_name = 'PartnerLogoDetailV2'


class ResourceListSerializer(serializers.ModelSerializer):
    resource_url = serializers.SerializerMethodField()

    def get_resource_url(self, obj):
        return obj.resource.url if obj.resource else None

    class Meta:
        model = Resource
        fields = ['id', 'title', 'link', 'resource_url', 'order']
        ref_name = 'ResourceListV2'


class ResourceDetailSerializer(serializers.ModelSerializer):
    resource_url = serializers.SerializerMethodField()

    def get_resource_url(self, obj):
        return obj.resource.url if obj.resource else None

    class Meta:
        model = Resource
        fields = '__all__'
        ref_name = 'ResourceDetailV2'
