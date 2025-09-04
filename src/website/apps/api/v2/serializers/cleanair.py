"""
CleanAir app serializers for v2 API

Special attention to cleanair app as per requirements:
- Admin badges, SEO fields, media preview
- Featured route and increment_views action
"""
from rest_framework import serializers
from apps.cleanair.models import CleanAirResource, ForumEvent
from ..utils import DynamicFieldsSerializerMixin


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

        if obj.end_date and obj.end_date < now:
            return 'past'
        elif obj.start_date > now:
            return 'upcoming'
        else:
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

        if obj.end_date and obj.end_date < now:
            return 'past'
        elif obj.start_date > now:
            return 'upcoming'
        else:
            return 'ongoing'

    class Meta:
        model = ForumEvent
        ref_name = 'ForumEventDetailSerializerV2'
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
            'background_image_url',
            'event_status',
            'order',
            'created',
            'modified',
            'is_deleted',
        ]
