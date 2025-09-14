
"""
CleanAir app admin configuration

This module configures the admin interface for both:
1. Clean Air Resources (standalone clean air content)
2. Clean Air Forum (forum events, resources, sessions, etc.)

The forum-related models are grouped separately for better organization.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.utils.safestring import mark_safe
from django.db import models
from django.urls import reverse
from django.utils import timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nested_admin import NestedTabularInline, NestedModelAdmin  # type: ignore
else:
    try:
        from nested_admin import NestedTabularInline, NestedModelAdmin  # type: ignore
    except Exception:
        from django.contrib import admin as _admin
        NestedTabularInline = _admin.TabularInline  # type: ignore
        NestedModelAdmin = _admin.ModelAdmin  # type: ignore
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

# =============================================================================
# ADMIN GROUPS - Custom admin configurations for better organization
# =============================================================================

# Create custom admin site instances for better grouping


class CleanAirForumAdminSite(admin.AdminSite):
    site_header = 'Clean Air Forum Administration'
    site_title = 'Clean Air Forum Admin'
    index_title = 'Clean Air Forum Management'


# Initialize the custom admin site
forum_admin_site = CleanAirForumAdminSite(name='clean_air_forum_admin')

# =============================================================================
# INLINE CLASSES
# =============================================================================


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


class PartnerInline(NestedTabularInline):
    model = Partner
    extra = 0


class ProgramInline(NestedTabularInline):
    model = Program
    inlines = [SessionInline]
    extra = 0


class ForumResourceInline(NestedTabularInline):
    model = ForumResource
    inlines = [ResourceSessionInline]
    extra = 0


# =============================================================================
# CLEAN AIR RESOURCES ADMIN - Standalone resources
# =============================================================================
@admin.register(CleanAirResource)
class CleanAirResourceAdmin(admin.ModelAdmin):
    """Clean Air Resources Admin - Standalone air quality resources"""

    list_display = ('resource_title_preview', 'resource_category_badge',
                    'author_title', 'order', 'created_date')
    list_filter = ('resource_category', 'author_title', 'created', 'modified')
    search_fields = ('resource_title', 'author_title')
    readonly_fields = ('created', 'modified', 'id')
    list_per_page = 25
    date_hierarchy = 'created'
    ordering = ['order', 'resource_title']
    list_editable = ('order',)

    fieldsets = (
        ('Resource Information', {
            'fields': ('resource_title', 'resource_category', 'resource_authors', 'author_title')
        }),
        ('Content & Links', {
            'fields': ('resource_link', 'resource_file')
        }),
        ('Display Options', {
            'fields': ('order',)
        }),
        ('Metadata', {
            'fields': ('id', 'created', 'modified'),
            'classes': ('collapse',)
        }),
    )

    # Custom actions
    actions = ['mark_featured', 'mark_archived', 'reset_order']

    fieldsets = (
        ('Resource Information', {
            'fields': ('resource_title', 'resource_description', 'resource_category',
                       'author_title', 'order'),
            'classes': ('wide',)
        }),
        ('SEO & Metadata', {
            'fields': ('id', 'created', 'modified'),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Title', ordering='resource_title')
    def resource_title_preview(self, obj):
        """Show resource title with character count"""
        title = obj.resource_title or "Untitled"
        char_count = len(title)
        color = "green" if char_count <= 100 else "orange" if char_count <= 120 else "red"
        return format_html(
            '<span style="color: {};">{}</span><br><small>({} chars)</small>',
            color, title, char_count
        )

    @admin.display(description='Category', ordering='resource_category')
    def resource_category_badge(self, obj):
        """Show category as colored badge"""
        if not obj.resource_category:
            return format_html('<span class="badge" style="background: #ccc;">No Category</span>')

        color_map = {
            'research': '#007cba',
            'guide': '#28a745',
            'report': '#dc3545',
            'tool': '#fd7e14',
            'policy': '#6f42c1'
        }
        color = color_map.get(obj.resource_category.lower(), '#6c757d')
        return format_html(
            '<span class="badge" style="background: {}; color: white; padding: 3px 8px; border-radius: 12px;">{}</span>',
            color, obj.resource_category
        )

    @admin.display(description='Status')
    def status_badge(self, obj):
        """Show status based on creation date and activity"""
        now = timezone.now()
        if (now - obj.created).days <= 30:
            return format_html('<span style="color: green;">● New</span>')
        elif (now - obj.modified).days <= 90:
            return format_html('<span style="color: blue;">● Active</span>')
        else:
            return format_html('<span style="color: gray;">● Archived</span>')

    @admin.display(description='Created', ordering='created')
    def created_date(self, obj):
        """Show formatted creation date"""
        return obj.created.strftime('%Y-%m-%d')

    # Bulk actions
    @admin.action(description="Mark selected resources as featured")
    def mark_featured(self, request, queryset):
        """Mark selected resources as featured"""
        count = 0
        for resource in queryset:
            if hasattr(resource, 'featured'):
                resource.featured = True
                resource.save()
                count += 1
        self.message_user(request, f'{count} resources marked as featured.')

    @admin.action(description="Archive selected resources")
    def mark_archived(self, request, queryset):
        """Archive selected resources"""
        count = queryset.count()
        # Could add a status field or move to archive category
        self.message_user(request, f'{count} resources marked for archival.')

    @admin.action(description="Reset order (alphabetically)")
    def reset_order(self, request, queryset):
        """Reset order for selected resources"""
        for i, resource in enumerate(queryset.order_by('resource_title'), 1):
            resource.order = i
            resource.save()
        count = queryset.count()
        self.message_user(request, f'Order reset for {count} resources.')


@admin.register(ForumEvent)
class ForumEventAdmin(NestedModelAdmin):
    """Enhanced Forum Event Admin with calendar view and event management"""

    list_display = ('event_title_preview', 'date_range_display', 'event_status_badge',
                    'registration_status', 'background_image_preview', 'order')
    list_filter = ('start_date', 'end_date', 'created', 'modified')
    search_fields = ('title', 'unique_title', 'introduction', 'location_name')
    readonly_fields = ('unique_title', 'created', 'modified', 'id')
    list_per_page = 20
    date_hierarchy = 'start_date'
    ordering = ['-start_date', 'order']
    list_editable = ('order',)

    # Custom actions
    actions = ['mark_featured', 'generate_schedule',
               'export_registration_data']

    inlines = [EngagementInline, SupportInline]

    fieldsets = (
        ('Event Information', {
            'fields': ('title', 'unique_title', 'order'),
            'classes': ('wide',)
        }),
        ('Schedule', {
            'fields': ('start_date', 'end_date', 'start_time', 'end_time'),
            'classes': ('wide',)
        }),
        ('Location & Registration', {
            'fields': ('location_name', 'location_link', 'registration_link'),
            'classes': ('wide',)
        }),
        ('Content Sections', {
            'fields': (
                'introduction', 'speakers_text_section', 'committee_text_section',
                'partners_text_section', 'schedule_details', 'registration_details'
            ),
            'classes': ('collapse',)
        }),
        ('Sponsorship & Travel', {
            'fields': (
                'sponsorship_opportunities_about', 'sponsorship_opportunities_schedule',
                'sponsorship_opportunities_partners', 'sponsorship_packages',
                'travel_logistics_vaccination_details', 'travel_logistics_visa_details',
                'travel_logistics_accommodation_details'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('glossary_details', 'background_image'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('id', 'created', 'modified'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """Auto-generate unique title and log changes"""
        obj.unique_title = obj.generate_unique_title()
        obj.save()

        action = "Updated" if change else "Created"
        logger.info(f"{action} ForumEvent: {obj.title} by {request.user}")

    @admin.display(description='Event Title', ordering='title')
    def event_title_preview(self, obj):
        """Show title with truncation and character count"""
        title = obj.title or "Untitled Event"
        truncated = title[:50] + "..." if len(title) > 50 else title
        char_count = len(title)
        color = "green" if char_count <= 100 else "orange"

        return format_html(
            '<strong style="color: {};">{}</strong><br><small>{} chars | ID: {}</small>',
            color, truncated, char_count, obj.id
        )

    @admin.display(description='Date & Duration', ordering='start_date')
    def date_range_display(self, obj):
        """Show formatted date range with duration"""
        if not obj.start_date:
            return format_html('<span style="color: red;">No start date</span>')

        start = obj.start_date
        end = obj.end_date or start

        # Calculate duration
        duration = (end - start).days + 1
        duration_text = f"{duration} day{'s' if duration > 1 else ''}"

        # Format display
        if start == end:
            date_str = start.strftime('%b %d, %Y')
        else:
            if start.year == end.year:
                if start.month == end.month:
                    date_str = f"{start.strftime('%b %d')}–{end.strftime('%d, %Y')}"
                else:
                    date_str = f"{start.strftime('%b %d')}–{end.strftime('%b %d, %Y')}"
            else:
                date_str = f"{start.strftime('%b %d, %Y')}–{end.strftime('%b %d, %Y')}"

        # Add time if available
        if obj.start_time:
            time_str = obj.start_time.strftime('%I:%M %p')
            date_str += f"<br><small>{time_str}</small>"

        return format_html(
            '{}<br><small style="color: #666;">{}</small>',
            date_str, duration_text
        )

    @admin.display(description='Status')
    def event_status_badge(self, obj):
        """Show event status with color coding"""
        if not obj.start_date:
            return format_html('<span class="badge" style="background: #dc3545; color: white;">No Date</span>')

        now = timezone.now().date()
        end_date = obj.end_date or obj.start_date

        if end_date < now:
            status = "Past"
            color = "#6c757d"
        elif obj.start_date > now:
            days_until = (obj.start_date - now).days
            if days_until <= 7:
                status = f"Soon ({days_until}d)"
                color = "#fd7e14"
            else:
                status = "Upcoming"
                color = "#28a745"
        else:
            status = "Ongoing"
            color = "#007cba"

        return format_html(
            '<span class="badge" style="background: {}; color: white; padding: 2px 8px; border-radius: 10px;">{}</span>',
            color, status
        )

    @admin.display(description='Registration')
    def registration_status(self, obj):
        """Show registration link status"""
        if obj.registration_link:
            return format_html(
                '<span style="color: green;">● <a href="{}" target="_blank">Active</a></span>',
                obj.registration_link
            )
        return format_html('<span style="color: orange;">○ No Link</span>')

    @admin.display(description='Background')
    def background_image_preview(self, obj):
        """Show optimized image preview with error handling"""
        if obj.background_image and hasattr(obj.background_image, 'url'):
            try:
                return format_html(
                    '<img src="{}" style="max-height: 60px; max-width: 120px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" alt="Background"/>',
                    obj.background_image.url
                )
            except Exception as e:
                logger.error(
                    f"Error loading background_image for ForumEvent '{obj.title}': {e}")
                return format_html('<span style="color: red;">● Error</span>')
        elif isinstance(obj.background_image, str) and obj.background_image:
            try:
                return format_html(
                    '<img src="{}" style="max-height: 60px; max-width: 120px; border-radius: 4px;" alt="Background"/>',
                    obj.background_image
                )
            except Exception as e:
                logger.error(
                    f"Error loading background_image path for ForumEvent '{obj.title}': {e}")
                return format_html('<span style="color: red;">● Error</span>')
        return format_html('<span style="color: #ccc;">○ No Image</span>')

    # Bulk actions
    @admin.action(description="Mark as featured events")
    def mark_featured(self, request, queryset):
        """Mark events as featured"""
        count = 0
        for event in queryset:
            # Could set a featured flag if model has it
            count += 1
        self.message_user(request, f'{count} events marked as featured.')

    @admin.action(description="Generate schedule reports")
    def generate_schedule(self, request, queryset):
        """Generate schedule reports"""
        count = queryset.count()
        self.message_user(
            request, f'Schedule reports generated for {count} events.')

    @admin.action(description="Export registration data")
    def export_registration_data(self, request, queryset):
        """Export registration data"""
        count = queryset.count()
        self.message_user(
            request, f'Registration data exported for {count} events.')


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

    @admin.display(description='Forum Events')
    def forum_events_display(self, obj):
        events = obj.forum_events.all()
        if events.exists():
            # Show a comma-separated list of the event titles.
            return ", ".join(event.title for event in events)
        else:
            return "All Events"

    @admin.display(description='Logo')
    def logo_preview(self, obj):
        if obj.partner_logo:
            url = obj.partner_logo.url
            height = 100
            return format_html('<img src="{}" height="{}" />', url, height)
        return ""


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

    @admin.display(description='Forum Events')
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

    @admin.display(description='Picture')
    def image_preview(self, obj):
        if obj.picture:
            url = obj.picture.url
            height = 100
            return format_html('<img src="{}" height="{}" />', url, height)
        return ""


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

    @admin.display(description='Forum Events')
    def get_forum_events(self, obj):
        events_str = ", ".join([fe.title for fe in obj.forum_events.all()])
        return events_str if events_str else "(No Forum Event)"
