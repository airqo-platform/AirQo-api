
from rest_framework import serializers
from .models import (
    Event, Inquiry, Program, Session, PartnerLogo, Resource,
    Organizer, EventOrganizer, Partner, EventPartner,
)


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


class OrganizerSerializer(serializers.ModelSerializer):
    """Legacy v1 organizer serializer used inside Event detail responses."""
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Organizer
        fields = ['id', 'name', 'slug', 'logo_url', 'website_url', 'order']
        ref_name = 'EventOrganizerSerializerV1'

    def get_logo_url(self, obj):
        return obj.logo.url if obj.logo else None


class EventOrganizerLinkSerializer(serializers.ModelSerializer):
    """Legacy v1 EventOrganizer through-model serializer."""
    organizer = OrganizerSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = EventOrganizer
        fields = ['organizer', 'role', 'role_display', 'order']
        ref_name = 'EventOrganizerLinkV1'


class PartnerSerializer(serializers.ModelSerializer):
    """Legacy v1 partner serializer used inside Event detail responses."""
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = ['id', 'name', 'slug', 'logo_url', 'website_url', 'order']
        ref_name = 'EventPartnerSerializerV1'

    def get_logo_url(self, obj):
        return obj.logo.url if obj.logo else None


class EventPartnerLinkSerializer(serializers.ModelSerializer):
    """Legacy v1 EventPartner through-model serializer."""
    partner = PartnerSerializer(read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = EventPartner
        fields = ['partner', 'role', 'role_display', 'order']
        ref_name = 'EventPartnerLinkV1'


class EventSideEventSummarySerializer(serializers.Serializer):
    """Lightweight side-event summary for legacy v1 detail responses.

    Accepts either an Event or an EventSideEvent link row.
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
        ref_name = 'EventSideEventSummaryV1'

    def _resolve(self, obj):
        return getattr(obj, 'side_event', obj)

    def get_public_identifier(self, obj):
        e = self._resolve(obj)
        return e.slug if e.slug else str(e.id)

    def get_api_url(self, obj):
        e = self._resolve(obj)
        identifier = e.slug if e.slug else e.id
        return f"/website/events/{identifier}/"

    def get_title(self, obj):
        return self._resolve(obj).title

    def get_start_date(self, obj):
        return self._resolve(obj).start_date

    def get_end_date(self, obj):
        return self._resolve(obj).end_date

    def get_start_time(self, obj):
        return self._resolve(obj).start_time

    def get_end_time(self, obj):
        return self._resolve(obj).end_time

    def get_location_name(self, obj):
        return self._resolve(obj).location_name

    def get_location_link(self, obj):
        return self._resolve(obj).location_link

    def get_event_image_url(self, obj):
        e = self._resolve(obj)
        return e.event_image.url if e.event_image else None

    def get_event_category(self, obj):
        return self._resolve(obj).event_category

    def get_event_category_display(self, obj):
        return self._resolve(obj).get_event_category_display()

    def get_event_status(self, obj):
        return self._resolve(obj).get_event_status()

    def get_label(self, obj):
        return getattr(obj, 'label', 'Side event')

    def get_order(self, obj):
        return getattr(obj, 'order', 1)


class EventParentSummarySerializer(serializers.Serializer):
    """Legacy v1 parent-event summary used in `side_event_of` backlink."""
    public_identifier = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    title = serializers.CharField()

    def get_public_identifier(self, obj):
        return obj.slug if obj.slug else str(obj.id)

    def get_api_url(self, obj):
        identifier = obj.slug if obj.slug else obj.id
        return f"/website/events/{identifier}/"


class EventListSerializer(serializers.ModelSerializer):
    event_tag = serializers.CharField(source='get_event_tag_display')
    event_image_url = serializers.SerializerMethodField()
    organizers_count = serializers.SerializerMethodField()
    partners_count = serializers.SerializerMethodField()
    is_side_event = serializers.SerializerMethodField()

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
            'order',
            'event_image_url',
            'organizers_count',
            'partners_count',
            'is_side_event',
        ]
        ref_name = 'EventListV1'

    def get_event_image_url(self, obj):
        if obj.event_image:
            return obj.event_image.url  # Directly use the .url attribute
        return None

    def get_organizers_count(self, obj):
        try:
            return obj.event_organizer_links.filter(
                is_deleted=False, organizer__is_deleted=False
            ).count()
        except Exception:
            return 0

    def get_partners_count(self, obj):
        try:
            return obj.event_partner_links.filter(
                is_deleted=False, partner__is_deleted=False
            ).count()
        except Exception:
            return 0

    def get_is_side_event(self, obj):
        try:
            return bool(obj.is_side_event)
        except Exception:
            return False


class EventDetailSerializer(serializers.ModelSerializer):
    event_image_url = serializers.SerializerMethodField()
    background_image_url = serializers.SerializerMethodField()
    inquiries = InquirySerializer(many=True, read_only=True)
    programs = ProgramSerializer(many=True, read_only=True)
    partner_logos = PartnerLogoSerializer(many=True, read_only=True)
    resources = ResourceSerializer(many=True, read_only=True)
    event_tag = serializers.CharField(source='get_event_tag_display')
    organizers = serializers.SerializerMethodField()
    partners = serializers.SerializerMethodField()
    side_events = serializers.SerializerMethodField()
    is_side_event = serializers.SerializerMethodField()
    side_event_of = serializers.SerializerMethodField()

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
            'organizers',
            'partners',
            'side_events',
            'is_side_event',
            'side_event_of',
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

    def get_is_side_event(self, obj):
        try:
            return bool(obj.is_side_event)
        except Exception:
            return False

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

    def get_side_event_of(self, obj):
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

    def get_side_events(self, obj):
        try:
            links = list(
                obj.side_event_links.select_related('side_event')
                .filter(is_deleted=False, side_event__is_deleted=False)
                .order_by('order', 'id')
            )
        except Exception:
            links = []
        return EventSideEventSummarySerializer(links, many=True).data
