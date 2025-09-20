"""
CleanAir app serializers for v2 API

Special attention to cleanair app as per requirements:
- Admin badges, SEO fields, media preview
- Featured route and increment_views action
"""
from rest_framework import serializers
from apps.cleanair.models import (
    CleanAirResource,
    ForumEvent,
    Partner,
    Person,
    Program,
    Session,
    Support,
    ForumResource,
    Section,
    Engagement,
    ResourceSession,
    ResourceFile,
    Objective,
)
from ..utils import DynamicFieldsSerializerMixin


class PartnerSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    partner_logo_url = serializers.SerializerMethodField()

    def get_partner_logo_url(self, obj):
        return obj.partner_logo.url if obj.partner_logo else None

    class Meta:
        model = Partner
        fields = ['id', 'name', 'partner_logo_url', 'partner_logo',
                  'website_link', 'category', 'order', 'created', 'modified', 'is_deleted', 'authored_by', 'forum_events']
        ref_name = 'ForumPartnerV2'


class PersonSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    picture_url = serializers.SerializerMethodField()

    def get_picture_url(self, obj):
        return obj.picture.url if obj.picture else None

    class Meta:
        model = Person
        fields = ['id', 'name', 'title', 'picture', 'picture_url', 'bio', 'category', 'order',
                  'twitter', 'linked_in', 'created', 'modified', 'is_deleted', 'forum_events']
        ref_name = 'ForumPersonV2'


class SessionSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = ['id', 'session_title', 'start_time',
                  'end_time', 'session_details', 'order', 'created', 'modified', 'is_deleted', 'program', 'authored_by']
        ref_name = 'ForumSessionV2'


class ResourceFileSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    session = serializers.IntegerField(source='session.id', read_only=True)

    def get_file_url(self, obj):
        return obj.file.url if obj.file else None

    class Meta:
        model = ResourceFile
        # Use explicit fields to match old API
        fields = ['file_url', 'resource_summary', 'session']
        ref_name = 'ForumResourceFileV2'


class ResourceSessionSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    resource_files = ResourceFileSerializer(many=True, read_only=True)

    class Meta:
        model = ResourceSession
        fields = ['id', 'session_title', 'resource_files', 'order',
                  'created', 'modified', 'is_deleted', 'forum_resource']
        ref_name = 'ForumResourceSessionV2'


class ProgramSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    sessions = SessionSerializer(many=True, read_only=True)

    class Meta:
        model = Program
        fields = ['id', 'title', 'sub_text', 'order', 'sessions',
                  'created', 'modified', 'is_deleted', 'forum_event', 'authored_by']
        ref_name = 'ForumProgramV2'


class SupportSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Support
        fields = ['id', 'query', 'name', 'role', 'email',
                  'order', 'created', 'modified', 'is_deleted', 'event']
        ref_name = 'ForumSupportV2'


class ForumResourceSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    # Expand resource sessions with files for detail responses
    resource_sessions = ResourceSessionSerializer(many=True, read_only=True)

    class Meta:
        model = ForumResource
        fields = ['id', 'resource_title',
                  'resource_authors', 'order', 'resource_sessions', 'created', 'modified', 'is_deleted', 'forum_event']
        ref_name = 'ForumResourceV2'


class SectionSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ['id', 'title', 'content', 'section_type',
                  'reverse_order', 'pages', 'order']
        ref_name = 'ForumSectionV2'


class EngagementSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    objectives = serializers.SerializerMethodField()

    def get_objectives(self, obj):
        # Use nested Objective serializer inline to avoid import cycles
        from apps.cleanair.models import Objective

        class ObjectiveSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
            class Meta:
                model = Objective
                fields = ['id', 'title', 'details', 'order',
                          'created', 'modified', 'is_deleted', 'engagement']
                ref_name = 'ForumObjectiveV2'

        qs = getattr(obj, 'objectives', None)
        if qs is None:
            return []
        serializer = ObjectiveSerializer(qs.all(), many=True)
        return serializer.data

    class Meta:
        model = Engagement
        fields = ['id', 'title', 'objectives', 'created',
                  'modified', 'is_deleted', 'forum_event']
        ref_name = 'ForumEngagementV2'


class CleanAirResourceListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    List serializer for CleanAirResource - optimized for listing
    """
    resource_file_url = serializers.SerializerMethodField()
    resource_category_display = serializers.CharField(
        source='get_resource_category_display', read_only=True)

    def get_resource_file_url(self, obj):
        """Return the secure URL for the resource file"""
        if obj.resource_file:
            return obj.resource_file.url
        return None

    class Meta:
        model = CleanAirResource
        fields = [
            'id',
            'resource_title',
            'resource_link',
            'resource_file_url',
            'author_title',
            'resource_category',
            'resource_category_display',
            'resource_authors',
            'order',
            'created',
            'modified',
        ]
        ref_name = 'CleanairListV2'


class CleanAirResourceDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    Detail serializer for CleanAirResource - includes all fields
    """
    resource_file_url = serializers.SerializerMethodField()
    resource_category_display = serializers.CharField(
        source='get_resource_category_display', read_only=True)

    def get_resource_file_url(self, obj):
        """Return the secure URL for the resource file"""
        if obj.resource_file:
            return obj.resource_file.url
        return None

    class Meta:
        model = CleanAirResource
        fields = [
            'id',
            'resource_title',
            'resource_link',
            'resource_file_url',
            'author_title',
            'resource_category',
            'resource_category_display',
            'resource_authors',
            'order',
            'created',
            'modified',
            'is_deleted',
        ]
        ref_name = 'CleanairDetailV2'


class ForumEventListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    List serializer for ForumEvent - essential fields for listing
    """
    background_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()

    def get_background_image_url(self, obj):
        """Return the secure URL for the background image"""
        if obj.background_image:
            return obj.background_image.url
        return None

    def get_event_status(self, obj):
        """Determine event status based on dates"""
        from django.utils import timezone
        now = timezone.now().date()

        # Treat missing end_date as single-day event
        effective_end = obj.end_date or obj.start_date

        if obj.start_date > now:
            return 'upcoming'
        if effective_end < now:
            return 'past'
        return 'ongoing'

    class Meta:
        model = ForumEvent
        ref_name = 'ForumEventListSerializerV2'
        fields = [
            'id',
            'title',
            'title_subtext',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'location_name',
            'location_link',
            'registration_link',
            'unique_title',
            'background_image_url',
            'event_status',
            'order',
            'created',
            'modified',
        ]


class ForumEventDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    Detail serializer for ForumEvent - includes all fields including QuillFields
    """
    background_image_url = serializers.SerializerMethodField()
    event_status = serializers.SerializerMethodField()

    def get_background_image_url(self, obj):
        """Return the secure URL for the background image"""
        if obj.background_image:
            return obj.background_image.url
        return None

    def get_event_status(self, obj):
        """Determine event status based on dates"""
        from django.utils import timezone
        now = timezone.now().date()

        # Treat missing end_date as single-day event
        effective_end = obj.end_date or obj.start_date

        if obj.start_date > now:
            return 'upcoming'
        if effective_end < now:
            return 'past'
        return 'ongoing'

    class Meta:
        model = ForumEvent
        ref_name = 'ForumEventDetailSerializerV2'
        # Include nested related models for full detail responses
        fields = [
            'id',
            'title',
            'title_subtext',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'introduction',
            'speakers_text_section',
            'committee_text_section',
            'partners_text_section',
            'location_name',
            'location_link',
            'registration_link',
            'schedule_details',
            'registration_details',
            'sponsorship_opportunities_about',
            'sponsorship_opportunities_schedule',
            'sponsorship_opportunities_partners',
            'sponsorship_packages',
            'travel_logistics_vaccination_details',
            'travel_logistics_visa_details',
            'travel_logistics_accommodation_details',
            'glossary_details',
            'unique_title',
            'background_image',
            'background_image_url',
            'event_status',
            'order',
            'created',
            'modified',
            'is_deleted',
            # nested relations
            'sections',
            'partners',
            'persons',
            'programs',
            'supports',
            'forum_resources',
            'engagement',
        ]

    # Add nested fields as serializer attributes
    sections = SectionSerializer(many=True, read_only=True)
    partners = PartnerSerializer(many=True, read_only=True)
    persons = PersonSerializer(many=True, read_only=True)
    programs = ProgramSerializer(many=True, read_only=True)
    supports = SupportSerializer(many=True, read_only=True)
    forum_resources = ForumResourceSerializer(many=True, read_only=True)
    engagement = EngagementSerializer(read_only=True)
