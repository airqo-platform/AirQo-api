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
- Organizers and side-event relationships
"""
from rest_framework import serializers
from apps.event.models import (
    Event, Inquiry, Program, Session, PartnerLogo, Resource,
    Organizer, EventOrganizer, Partner, EventPartner,
)
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


class OrganizerSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Organizer."""
    logo_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_logo_url(self, obj):
        return obj.logo.url if obj.logo else None

    class Meta:
        model = Organizer
        fields = [
            'id', 'name', 'slug', 'logo_url', 'website_url',
            'description', 'order', 'created', 'modified',
        ]
        ref_name = 'OrganizerV2'


class EventOrganizerLinkSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Serializer for the EventOrganizer through model (organizer + link metadata)."""
    organizer = OrganizerSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = EventOrganizer
        fields = ['id', 'organizer', 'role', 'role_display', 'order']
        ref_name = 'EventOrganizerLinkV2'


class PartnerSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Detail serializer for Partner catalog entry."""
    logo_url = serializers.SerializerMethodField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_logo_url(self, obj):
        return obj.logo.url if obj.logo else None

    class Meta:
        model = Partner
        fields = [
            'id', 'name', 'slug', 'logo_url', 'website_url',
            'description', 'order', 'created', 'modified',
        ]
        ref_name = 'PartnerV2'


class EventPartnerLinkSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """Serializer for the EventPartner through model (partner + link metadata)."""
    partner = PartnerSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = EventPartner
        fields = ['id', 'partner', 'role', 'role_display', 'order']
        ref_name = 'EventPartnerLinkV2'


class EventSideEventSummarySerializer(DynamicFieldsSerializerMixin, serializers.Serializer):
    """Lightweight summary for a side event when nested under a main event.

    Accepts either an :class:`Event` instance or an :class:`EventSideEvent`
    link row (in which case the related `side_event` is used as the source
    of event attributes).
    """
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    start_date = serializers.SerializerMethodField()
    end_date = serializers.SerializerMethodField()
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    location_name = serializers.SerializerMethodField()
    location_link = serializers.SerializerMethodField()
    event_image_url = serializers.SerializerMethodField()
    event_category = serializers.SerializerMethodField()
    event_category_display = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()
    order = serializers.SerializerMethodField()

    class Meta:
        ref_name = 'EventSideEventSummaryV2'

    def _instance_id(self, obj):
        """Resolve the related Event instance for a side_event link row."""
        # When used on EventSideEvent instances, the related event is `side_event`
        return getattr(obj, 'side_event', obj)

    def get_public_identifier(self, obj):
        event = self._instance_id(obj)
        return event.slug if event.slug else str(event.id)

    def get_api_url(self, obj):
        event = self._instance_id(obj)
        if hasattr(event, 'get_absolute_url'):
            return event.get_absolute_url()
        identifier = event.slug if event.slug else event.id
        return f"/website/api/v2/events/{identifier}/"

    def get_title(self, obj):
        return self._instance_id(obj).title

    def get_start_date(self, obj):
        return self._instance_id(obj).start_date

    def get_end_date(self, obj):
        return self._instance_id(obj).end_date

    def get_start_time(self, obj):
        return self._instance_id(obj).start_time

    def get_end_time(self, obj):
        return self._instance_id(obj).end_time

    def get_location_name(self, obj):
        return self._instance_id(obj).location_name

    def get_location_link(self, obj):
        return self._instance_id(obj).location_link

    def get_event_image_url(self, obj):
        event = self._instance_id(obj)
        return event.event_image.url if event.event_image else None

    def get_event_category(self, obj):
        return self._instance_id(obj).event_category

    def get_event_category_display(self, obj):
        return self._instance_id(obj).get_event_category_display()

    def get_event_status(self, obj):
        event = self._instance_id(obj)
        return event.get_event_status()

    def get_label(self, obj):
        # Only meaningful when obj is an EventSideEvent link row.
        return getattr(obj, 'label', 'Side event')

    def get_order(self, obj):
        return getattr(obj, 'order', 1)


class EventParentSummarySerializer(serializers.Serializer):
    """Minimal parent-event summary used in `side_event_of` backlink."""
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    title = serializers.CharField()

    @extend_schema_field(serializers.CharField())
    def get_public_identifier(self, obj):
        return obj.slug if obj.slug else str(obj.id)

    @extend_schema_field(serializers.CharField())
    def get_api_url(self, obj):
        if hasattr(obj, 'get_absolute_url'):
            return obj.get_absolute_url()
        identifier = obj.slug if obj.slug else obj.id
        return f"/website/api/v2/events/{identifier}/"


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

    # New: lightweight summary fields
    organizers_count = serializers.SerializerMethodField()
    partners_count = serializers.SerializerMethodField()
    is_side_event = serializers.SerializerMethodField()

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

    @extend_schema_field(serializers.IntegerField())
    def get_organizers_count(self, obj):
        # Prefer the annotation added by the viewset to avoid N+1.
        annotated = getattr(obj, '_organizers_count', None)
        if annotated is not None:
            try:
                return int(annotated)
            except (TypeError, ValueError):
                pass
        # Fallback: check the specific prefetched relation.
        cache = getattr(obj, '_prefetched_objects_cache', None)
        if cache and 'event_organizer_links' in cache:
            return len(cache['event_organizer_links'])
        return 0

    @extend_schema_field(serializers.IntegerField())
    def get_partners_count(self, obj):
        # Prefer the annotation added by the viewset to avoid N+1.
        annotated = getattr(obj, '_partners_count', None)
        if annotated is not None:
            try:
                return int(annotated)
            except (TypeError, ValueError):
                pass
        # Fallback: check the specific prefetched relation.
        cache = getattr(obj, '_prefetched_objects_cache', None)
        if cache and 'event_partner_links' in cache:
            return len(cache['event_partner_links'])
        return 0

    @extend_schema_field(serializers.BooleanField())
    def get_is_side_event(self, obj):
        # Prefer the annotation added by the viewset to avoid N+1.
        annotated = getattr(obj, '_parent_link_count', None)
        if annotated is not None:
            try:
                return int(annotated) > 0
            except (TypeError, ValueError):
                pass
        # Fallback: check the specific prefetched relation.
        cache = getattr(obj, '_prefetched_objects_cache', None)
        if cache and 'parent_event_links' in cache:
            return len(cache['parent_event_links']) > 0
        return False

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
            'public_identifier', 'api_url', 'has_slug',
            # Organizers & side-event metadata
            'organizers_count', 'partners_count', 'is_side_event',
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

    # Organizers and side events — use SerializerMethodField to filter
    # out soft-deleted links and deleted catalog rows.
    organizers = serializers.SerializerMethodField()
    partners = serializers.SerializerMethodField()
    side_events = serializers.SerializerMethodField()
    is_side_event = serializers.SerializerMethodField()
    side_event_of = serializers.SerializerMethodField()

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

    def get_organizers(self, obj):
        """Return organizers, filtering out soft-deleted links and rows."""
        links = obj.event_organizer_links.select_related('organizer').filter(
            is_deleted=False,
            organizer__is_deleted=False,
        ).order_by('order', 'id')
        return EventOrganizerLinkSerializer(links, many=True).data

    def get_partners(self, obj):
        """Return partners, filtering out soft-deleted links and rows."""
        links = obj.event_partner_links.select_related('partner').filter(
            is_deleted=False,
            partner__is_deleted=False,
        ).order_by('order', 'id')
        return EventPartnerLinkSerializer(links, many=True).data

    @extend_schema_field(serializers.BooleanField())
    def get_is_side_event(self, obj):
        try:
            return bool(obj.is_side_event)
        except Exception:
            return False

    @extend_schema_field(EventParentSummarySerializer(allow_null=True))
    def get_side_event_of(self, obj):
        """Return summary of the parent event (if this is a side event)."""
        try:
            link = obj.parent_event_links.select_related(
                'parent_event').filter(is_deleted=False).first()
        except Exception:
            link = None
        if not link:
            return None
        parent = link.parent_event
        if not parent or parent.is_deleted:
            return None
        return EventParentSummarySerializer(parent).data

    @extend_schema_field(EventSideEventSummarySerializer(many=True))
    def get_side_events(self, obj):
        """Return ordered list of side events (as summary payloads)."""
        try:
            links = list(
                obj.side_event_links.select_related('side_event')
                .filter(is_deleted=False, side_event__is_deleted=False)
                .order_by('order', 'id')
            )
        except Exception:
            links = []
        return EventSideEventSummarySerializer(links, many=True).data

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
