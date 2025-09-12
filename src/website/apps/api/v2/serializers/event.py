"""
Event app serializers for v2 API

Special features    class Meta:
        model = Event
        fields = [
            # Model fields
            'id', 'title', 'title_subtext', 'start_date', 'end_date',
            'start_time', 'end_time', 'event_tag', 'event_tag_display',
            'event_image_url', 'location_name', 'event_status', 'is_virtual',
            'registration_link', 'order', 'created', 'modified',
            # Slug fields (SerializerMethodFields from mixin)
        ]
        ref_name = 'EventListV2'pp as per requirements:
- Universal slug support with privacy-friendly URLs
- Date hierarchy
- Event type filtering 
- Virtual vs venue fields
- Registration counts
- Calendar-friendly fields
- Automatic ID hiding when slugs exist
"""
from rest_framework import serializers
from apps.event.models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from ..utils import DynamicFieldsSerializerMixin
from ..serializers.mixins import ListSerializerMixin, DetailSerializerMixin
from drf_spectacular.utils import extend_schema_field


class EventListSerializer(ListSerializerMixin, DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """List serializer for Event - optimized for listing with slug support"""
    event_tag_display = serializers.CharField(
        source='get_event_tag_display', read_only=True)
    event_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    is_virtual = serializers.SerializerMethodField()
    
    # Slug fields for privacy-friendly URLs
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    has_slug = serializers.SerializerMethodField()

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
        # Check if location indicates virtual event. Be defensive: handle None and non-str values.
        try:
            location = getattr(obj, 'location_name', None)
            if location is None:
                return False
            location_text = str(location)
            if not location_text:
                return False
            location_text = location_text.lower()
            return any(k in location_text for k in ('virtual', 'online', 'zoom'))
        except Exception:
            # In case of unexpected types, return False rather than raising.
            return False

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
            'event_image_url', 'location_name', 'event_status', 'is_virtual',
            'registration_link', 'order', 'created', 'modified',
            # Slug fields (SerializerMethodFields)
            'public_identifier', 'api_url', 'has_slug'
        ]
        ref_name = 'EventListV2'


class EventDetailSerializer(DetailSerializerMixin, DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Event with all related data and slug support"""
    event_tag_display = serializers.CharField(
        source='get_event_tag_display', read_only=True)
    event_image_url = serializers.SerializerMethodField()
    background_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    is_virtual = serializers.SerializerMethodField()
    
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
        from django.utils import timezone
        now = timezone.now().date()
        if obj.end_date and obj.end_date < now:
            return 'past'
        elif obj.start_date > now:
            return 'upcoming'
        return 'ongoing'

    @extend_schema_field(serializers.BooleanField())
    def get_is_virtual(self, obj):
        try:
            location = getattr(obj, 'location_name', None)
            if location is None:
                return False
            location_text = str(location)
            if not location_text:
                return False
            location_text = location_text.lower()
            return any(k in location_text for k in ('virtual', 'online', 'zoom'))
        except Exception:
            return False

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
        exclude = ['is_deleted']  # Include all fields except soft delete flag
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
