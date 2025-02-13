
from django.contrib import admin
from django.utils.html import format_html
from nested_admin import NestedTabularInline, NestedModelAdmin
from .models import (
    CleanAirResource,
    ForumEvent,
    ForumResource,
    Partner,
    Person,
    Program,
    Objective,
    Engagement,
    Session,
    Support,
    ResourceFile,
    ResourceSession, Section
)
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Inline Classes


class ObjectiveInline(NestedTabularInline):
    model = Objective
    extra = 0


class EngagementInline(NestedTabularInline):
    model = Engagement
    inlines = [ObjectiveInline]
    extra = 0


class SupportInline(NestedTabularInline):
    model = Support
    extra = 0


class SessionInline(NestedTabularInline):
    model = Session
    extra = 0


class ResourceFileInline(NestedTabularInline):
    model = ResourceFile
    extra = 1


class ResourceSessionInline(NestedTabularInline):
    model = ResourceSession
    extra = 1
    inlines = [ResourceFileInline]


class ForumResourceInline(NestedTabularInline):
    model = ForumResource
    inlines = [ResourceSessionInline]
    extra = 0


# Admin Classes
@admin.register(CleanAirResource)
class CleanAirResourceAdmin(admin.ModelAdmin):
    list_display = ('resource_title', 'resource_category',
                    'order', 'author_title')
    list_filter = ('resource_category', 'author_title')
    search_fields = ('resource_title', 'author_title')
    readonly_fields = ('author_title',)
    list_per_page = 12


@admin.register(ForumEvent)
class ForumEventAdmin(NestedModelAdmin):
    list_display = ('title', 'start_date', 'end_date',
                    'order', 'background_image_preview')
    list_filter = ('start_date', 'end_date')
    search_fields = ('title',)
    readonly_fields = ()
    list_per_page = 12
    inlines = [EngagementInline, SupportInline]

    def background_image_preview(self, obj):
        """Preview background image."""
        if obj.background_image and hasattr(obj.background_image, 'url'):
            try:
                return format_html(
                    '<img src="{}" style="max-height: 150px; max-width: 300px;" alt="Background Image"/>',
                    obj.background_image.url
                )
            except Exception as e:
                logger.error(
                    f"Error loading background_image for ForumEvent '{obj.title}': {e}")
                return "Error loading image."
        elif isinstance(obj.background_image, str) and obj.background_image:
            # Handle cases where background_image is a string path
            try:
                return format_html(
                    '<img src="{}" style="max-height: 150px; max-width: 300px;" alt="Background Image"/>',
                    obj.background_image
                )
            except Exception as e:
                logger.error(
                    f"Error loading background_image path for ForumEvent '{obj.title}': {e}")
                return "Error loading image."
        return "No image uploaded."

    background_image_preview.short_description = 'Background Image'


@admin.register(ForumResource)
class ForumResourceAdmin(NestedModelAdmin):
    inlines = [ResourceSessionInline]
    list_display = ('resource_title', 'resource_authors',
                    'order', 'forum_event')
    search_fields = ('resource_title', 'resource_authors')
    list_filter = ('forum_event',)
    list_per_page = 12


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ('name', 'forum_events_display',
                    'category', 'logo_preview', 'order')
    list_filter = ('forum_events', 'category',)
    search_fields = ('name', 'category', 'forum_events__title',)
    list_per_page = 12
    list_editable = ('order',)
    # Use the horizontal filter widget for the many-to-many field.
    filter_horizontal = ('forum_events',)

    def forum_events_display(self, obj):
        events = obj.forum_events.all()
        if events.exists():
            # Show a comma-separated list of the event titles.
            return ", ".join(event.title for event in events)
        else:
            return "All Events"
    forum_events_display.short_description = 'Forum Events'

    def logo_preview(self, obj):
        if obj.partner_logo:
            url = obj.partner_logo.url
            height = 100
            return format_html('<img src="{}" height="{}" />', url, height)
        return ""
    logo_preview.short_description = 'Logo'


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ('name', 'forum_events_display',
                    'category', 'image_preview', 'order')
    # Only scalar fields (like 'order') can be edited inline.
    list_editable = ('order',)
    list_filter = ('forum_events', 'category')
    search_fields = ('name', 'category', 'forum_events__title',)
    list_per_page = 12

    # Use the horizontal filter widget on the change form for the M2M field.
    filter_horizontal = ('forum_events',)

    def forum_events_display(self, obj):
        """
        Display the events linked to the person.
        If none are selected, interpret that as "All Events".
        """
        events = obj.forum_events.all()
        if events.exists():
            return ", ".join(event.title for event in events)
        else:
            return "All Events"
    forum_events_display.short_description = 'Forum Events'

    def image_preview(self, obj):
        if obj.picture:
            url = obj.picture.url
            height = 100
            return format_html('<img src="{}" height="{}" />', url, height)
        return ""
    image_preview.short_description = 'Picture'


@admin.register(Program)
class ProgramAdmin(NestedModelAdmin):
    list_display = ('title', 'forum_event',)
    list_filter = ('forum_event',)
    search_fields = ('title', 'forum_event__title',)
    list_per_page = 12
    inlines = [SessionInline]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('get_forum_events', 'title', 'section_type',
                    'reverse_order', 'pages', 'order')
    # Make both the title and forum events clickable.
    list_display_links = ('title', 'get_forum_events',)
    list_filter = ('section_type', 'forum_events', 'pages')
    search_fields = ('title',)
    list_per_page = 12
    list_editable = ('reverse_order', 'order', 'section_type',)
    filter_horizontal = ('forum_events',)

    def get_forum_events(self, obj):
        events_str = ", ".join([fe.title for fe in obj.forum_events.all()])
        return events_str if events_str else "(No Forum Event)"
    get_forum_events.short_description = "Forum Events"
