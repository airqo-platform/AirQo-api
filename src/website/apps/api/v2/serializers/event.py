"""
Event app serializers for v2 API

Special features as per requirements:
- Universal slug support with privacy-friendly URLs
- Date hierarchy
- Event type filtering 
- Virtual vs venue fields
- Registration counts
- Calendar-friendly fields
- Automatic ID hiding when slugs exist
- Complete nested data for all related models
"""
from rest_framework import serializers
from apps.event.models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from ..utils import DynamicFieldsSerializerMixin
from ..serializers.mixins import ListSerializerMixin, DetailSerializerMixin
from drf_spectacular.utils import extend_schema_field


class SessionListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for Session"""
    class Meta:
        model = Session
        fields = ['id', 'session_title', 'start_time',
                  'end_time', 'venue', 'order']
        ref_name = 'SessionListV2'


class SessionDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Session with all data"""
    class Meta:
        model = Session
        fields = '__all__'
        ref_name = 'SessionDetailV2'


class ProgramListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for Program with nested sessions"""
    sessions = SessionDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Program
        fields = ['id', 'date', 'program_details', 'order', 'sessions']
        ref_name = 'ProgramListV2'


class ProgramDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Program with all session data"""
    sessions = SessionDetailSerializer(many=True, read_only=True)

    class Meta:
        model = Program
        fields = '__all__'
        ref_name = 'ProgramDetailV2'


class InquiryListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for Inquiry"""
    class Meta:
        model = Inquiry
        fields = ['id', 'inquiry', 'role', 'email', 'order']
        ref_name = 'InquiryListV2'


class InquiryDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Inquiry with all data"""
    class Meta:
        model = Inquiry
        fields = '__all__'
        ref_name = 'InquiryDetailV2'


class PartnerLogoListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for PartnerLogo"""
    partner_logo_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = PartnerLogo
        fields = ['id', 'name', 'partner_logo_url', 'order']
        ref_name = 'PartnerLogoListV2'


class PartnerLogoDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for PartnerLogo with all data"""
    partner_logo_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = PartnerLogo
        fields = '__all__'
        ref_name = 'PartnerLogoDetailV2'


class ResourceListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for Resource"""
    resource_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_resource_url(self, obj):
        return obj.resource.url if obj.resource else None

    class Meta:
        model = Resource
        fields = ['id', 'title', 'link', 'resource_url', 'order']
        ref_name = 'ResourceListV2'


class ResourceDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Resource with all data"""
    resource_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_resource_url(self, obj):
        return obj.resource.url if obj.resource else None

    class Meta:
        model = Resource
        fields = '__all__'
        ref_name = 'ResourceDetailV2'


class EventListSerializer(DynamicFieldsSerializerMixin, ListSerializerMixin, serializers.ModelSerializer):
    """List serializer for Event - optimized for listing with slug support"""
    event_tag_display = serializers.CharField(
        source='get_event_tag_display', read_only=True)
    event_category_display = serializers.CharField(
        source='get_event_category_display', read_only=True)
    website_category_display = serializers.CharField(
        source='get_website_category_display', read_only=True)
    event_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    is_virtual = serializers.SerializerMethodField()
    duration_days = serializers.SerializerMethodField()

    # Slug fields for privacy-friendly URLs
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_event_image_url(self, obj):
        return obj.event_image.url if obj.event_image else None

    @extend_schema_field(serializers.CharField())
    def get_event_status(self, obj):
        return obj.get_event_status()

    @extend_schema_field(serializers.BooleanField())
    def get_is_virtual(self, obj):
        return obj.is_virtual_event()

    @extend_schema_field(serializers.IntegerField())
    def get_duration_days(self, obj):
        return obj.get_duration_days()

    def get_public_identifier(self, obj):
        """Get the public identifier (slug or fallback)"""
        return obj.slug if obj.slug else str(obj.id)

    def get_api_url(self, obj):
        """Get the API URL for the object"""
        if hasattr(obj, 'get_absolute_url'):
            return obj.get_absolute_url()
        identifier = obj.slug if obj.slug else obj.id
        return f"/website/api/v2/events/{identifier}/"

    def get_has_slug(self, obj):
        """Check if object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Override to conditionally hide ID for privacy"""
        data = super().to_representation(instance)

        # Hide ID if slug exists for privacy
        if instance.slug:
            data.pop('id', None)

        return data

    class Meta:
        model = Event
        fields = [
            # Model fields
            'id', 'title', 'title_subtext', 'start_date', 'end_date',
            'start_time', 'end_time', 'event_tag', 'event_tag_display',
            'event_category', 'event_category_display', 'website_category',
            'website_category_display', 'event_image_url', 'location_name',
            'location_link', 'event_status', 'is_virtual', 'duration_days',
            'registration_link', 'order', 'created', 'modified',
            # Slug fields (SerializerMethodFields)
            'public_identifier', 'api_url', 'has_slug'
        ]
        ref_name = 'EventListV2'


class EventDetailSerializer(DynamicFieldsSerializerMixin, DetailSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Event with ALL related data and slug support"""
    event_tag_display = serializers.CharField(
        source='get_event_tag_display', read_only=True)
    event_category_display = serializers.CharField(
        source='get_event_category_display', read_only=True)
    website_category_display = serializers.CharField(
        source='get_website_category_display', read_only=True)
    event_image_url = serializers.SerializerMethodField()
    background_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    is_virtual = serializers.SerializerMethodField()
    duration_days = serializers.SerializerMethodField()

    # Complete nested data for ALL related models
    inquiries = InquiryDetailSerializer(many=True, read_only=True)
    programs = ProgramDetailSerializer(many=True, read_only=True)
    partner_logos = PartnerLogoDetailSerializer(many=True, read_only=True)
    resources = ResourceDetailSerializer(many=True, read_only=True)

    # Slug fields for privacy-friendly URLs
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_event_image_url(self, obj):
        return obj.event_image.url if obj.event_image else None

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_background_image_url(self, obj):
        return obj.background_image.url if obj.background_image else None

    @extend_schema_field(serializers.CharField())
    def get_event_status(self, obj):
        return obj.get_event_status()

    @extend_schema_field(serializers.BooleanField())
    def get_is_virtual(self, obj):
        return obj.is_virtual_event()

    @extend_schema_field(serializers.IntegerField())
    def get_duration_days(self, obj):
        return obj.get_duration_days()

    def get_public_identifier(self, obj):
        """Get the public identifier (slug or fallback)"""
        return obj.slug if obj.slug else str(obj.id)

    def get_api_url(self, obj):
        """Get the API URL for the object"""
        if hasattr(obj, 'get_absolute_url'):
            return obj.get_absolute_url()
        identifier = obj.slug if obj.slug else obj.id
        return f"/website/api/v2/events/{identifier}/"

    def get_has_slug(self, obj):
        """Check if object has a slug"""
        return bool(obj.slug)

    def to_representation(self, instance):
        """Override to conditionally hide ID for privacy"""
        data = super().to_representation(instance)

        # Hide ID if slug exists for privacy
        if instance.slug:
            data.pop('id', None)

        return data

    class Meta:
        model = Event
        exclude = ['is_deleted']  # Include ALL fields except soft delete flag
        ref_name = 'EventDetailV2'
