from django.contrib import admin
from typing import TYPE_CHECKING
from django.utils.html import format_html

if TYPE_CHECKING:
    # Provide symbols to static type checkers
    from nested_admin import NestedTabularInline, NestedStackedInline, NestedModelAdmin  # type: ignore
else:
    try:
        from nested_admin import NestedTabularInline, NestedStackedInline, NestedModelAdmin  # type: ignore
    except Exception:
        # Fallbacks for runtime if nested_admin isn't available
        NestedTabularInline = admin.TabularInline  # type: ignore
        NestedStackedInline = admin.StackedInline  # type: ignore
        NestedModelAdmin = admin.ModelAdmin  # type: ignore
import logging

from .models import (
    Event, Inquiry, Program, Session, PartnerLogo, Resource,
    Organizer, EventOrganizer, EventSideEvent,
    Partner, EventPartner,
)

# Configure logger
logger = logging.getLogger(__name__)

# -------- Inline Classes --------


class InquiryInline(NestedTabularInline):
    model = Inquiry
    extra = 0
    sortable_field_name = 'order'
    fields = ('inquiry', 'role', 'email', 'order')
    ordering = ['order']


class PartnerLogoInline(NestedTabularInline):
    model = PartnerLogo
    extra = 0
    sortable_field_name = 'order'
    fields = ('name', 'partner_logo', 'order', 'preview_logo')
    readonly_fields = ('preview_logo',)

    @admin.display(description="Preview Logo")
    def preview_logo(self, obj):
        return preview_image(obj.partner_logo, obj.name, "Partner Logo", (100, 150))


class ResourceInline(NestedTabularInline):
    model = Resource
    extra = 0
    fields = ('title', 'link', 'resource', 'order', 'download_link')
    readonly_fields = ('download_link',)

    @admin.display(description="Resource Download Link")
    def download_link(self, obj):
        if not obj.resource:
            return "No resource uploaded."

        try:
            url = obj.resource.url if hasattr(
                obj.resource, 'url') else obj.resource
            return format_html('<a href="{}" target="_blank">Download</a>', url)
        except Exception as e:
            logger.error(
                f"Error generating download link for Resource '{obj.title}': {e}")
            return "Error generating link."

    # description is provided via @admin.display


class SessionInline(NestedTabularInline):
    model = Session
    extra = 0
    fields = ('session_title', 'start_time', 'end_time',
              'venue', 'session_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


class ProgramInline(NestedStackedInline):
    model = Program
    extra = 0
    fields = ('date', 'program_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']
    inlines = [SessionInline]


class EventOrganizerInline(NestedTabularInline):
    """Inline for attaching organizers (via EventOrganizer through) to an event."""
    model = EventOrganizer
    extra = 0
    autocomplete_fields = ('organizer',)
    fields = ('organizer', 'role', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


class EventSideEventInline(NestedTabularInline):
    """Inline for linking side events (via EventSideEvent through) to a parent event."""
    model = EventSideEvent
    fk_name = 'parent_event'
    extra = 0
    autocomplete_fields = ('side_event',)
    fields = ('side_event', 'label', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


class EventPartnerInline(NestedTabularInline):
    """Inline for attaching partners (via EventPartner through) to an event."""
    model = EventPartner
    extra = 0
    autocomplete_fields = ('partner',)
    fields = ('partner', 'role', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


def preview_image(image_field, obj_name, alt_text, max_dimensions):
    """Helper function to preview images with error handling."""
    if not image_field:
        return f"No {alt_text.lower()} uploaded."

    try:
        url = image_field.url if hasattr(image_field, 'url') else image_field
        max_height, max_width = max_dimensions
        return format_html(
            '<img src="{}" style="max-height: {}px; max-width: {}px;" alt="{}"/>',
            url, max_height, max_width, alt_text
        )
    except Exception as e:
        logger.error(f"Error loading {alt_text.lower()} for '{obj_name}': {e}")
        return f"Error loading {alt_text.lower()}."

# Event display in admin page


@admin.register(Event)
class EventAdmin(NestedModelAdmin):
    list_display = (
        'title',
        'event_kind_display',
        'event_status_display',
        'start_date',
        'end_date',
        'website_category',
        'event_category',
        'event_tag',
        'location_name',
        'organizers_summary',
        'partners_summary',
        'order',
        'preview_event_image',
        'preview_background_image'
    )
    search_fields = ('title', 'title_subtext',
                     'location_name', 'event_details')
    list_filter = (
        'website_category',
        'event_category',
        'event_tag',
        'start_date',
        'end_date',
        ('start_date', admin.DateFieldListFilter),
    )
    # Allow quick edits to both ordering and the event tag from the changelist
    list_editable = ('event_tag', 'order',)
    ordering = ('order', '-start_date')
    list_per_page = 15
    date_hierarchy = 'start_date'
    readonly_fields = (
        'preview_event_image',
        'preview_background_image',
        'event_status_display',
        'event_kind_display',
        'organizers_summary',
        'partners_summary',
        'slug',
        'created',
        'modified'
    )
    inlines = [
        InquiryInline,
        ProgramInline,
        ResourceInline,
        EventOrganizerInline,
        EventSideEventInline,
        EventPartnerInline,
    ]
    fieldsets = (
        ("Basic Information", {
            "fields": ('title', 'title_subtext', 'slug'),
            "classes": ('wide',),
        }),
        ("Schedule", {
            "fields": ('start_date', 'end_date', 'start_time', 'end_time', 'event_status_display'),
            "classes": ('wide',),
        }),
        ("Location & Registration", {
            "fields": ('location_name', 'location_link', 'registration_link'),
            "classes": ('wide',),
        }),
        ("Details", {
            "fields": ('event_details',),
            "classes": ('wide',),
        }),
        ("Images", {
            "fields": (
                ('event_image', 'preview_event_image'),
                ('background_image', 'preview_background_image')
            ),
            "classes": ('wide',),
        }),
        ("Categorization & Ordering", {
            "fields": ('website_category', 'event_category', 'event_tag', 'order'),
            "classes": ('wide',),
        }),
        ("Metadata", {
            "fields": ('created', 'modified'),
            "classes": ('collapse',),
        }),
    )

    class Media:
        css = {
            'all': ('admin/css/event_admin_custom.css',)
        }

    @admin.display(description="Event Image")
    def preview_event_image(self, obj):
        """Preview event image."""
        return preview_image(obj.event_image, obj.title, "Event Image", (150, 300))

    @admin.display(description="Background Image")
    def preview_background_image(self, obj):
        """Preview background image."""
        return preview_image(obj.background_image, obj.title, "Background Image", (150, 300))

    @admin.display(description="Status", ordering='start_date')
    def event_status_display(self, obj):
        """Display event status with color coding."""
        from django.utils import timezone
        now = timezone.now().date()

        # Treat missing end_date as single-day event
        effective_end = obj.end_date or obj.start_date

        # Upcoming if start_date is in the future
        if obj.start_date and obj.start_date > now:
            status = 'UPCOMING'
            color = '#28a745'  # Green
        # Past if the effective end is before today
        elif effective_end and effective_end < now:
            status = 'PAST'
            color = '#dc3545'  # Red
        else:
            # Otherwise it's ongoing (includes single-day events happening today)
            status = 'ONGOING'
            color = '#ffc107'  # Yellow

        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, status
        )

    @admin.display(description="Kind")
    def event_kind_display(self, obj):
        """Indicate whether the event is a main event or a side event."""
        try:
            is_side = obj.is_side_event
            has_sides = obj.has_side_events
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("event_kind_display failed: %s", exc)
            return "-"

        if is_side and has_sides:
            label, color = "BOTH", "#fd7e14"
        elif is_side:
            label, color = "SIDE EVENT", "#0d6efd"
        elif has_sides:
            label, color = "MAIN (+sides)", "#6f42c1"
        else:
            label, color = "MAIN", "#6c757d"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, label
        )

    @admin.display(description="Organizers")
    def organizers_summary(self, obj):
        """Quick summary of the organizers linked to this event."""
        try:
            links = obj.event_organizer_links.select_related('organizer').all()
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("organizers_summary failed: %s", exc)
            return "-"
        if not links:
            return format_html('<span style="color:#999;">—</span>')
        names = ", ".join(
            f"{link.organizer.name} ({link.get_role_display()})"
            for link in links
        )
        return format_html('<span title="{}">{}</span>', names, names[:60])

    @admin.display(description="Partners")
    def partners_summary(self, obj):
        """Quick summary of the partners linked to this event."""
        try:
            links = obj.event_partner_links.select_related('partner').all()
        except Exception as exc:  # pragma: no cover - defensive
            logger.error("partners_summary failed: %s", exc)
            return "-"
        if not links:
            return format_html('<span style="color:#999;">—</span>')
        names = ", ".join(
            f"{link.partner.name} ({link.get_role_display()})"
            for link in links
        )
        return format_html('<span title="{}">{}</span>', names, names[:60])

    def save_model(self, request, obj, form, change):
        """Use default admin save behavior; upload failures are handled by middleware."""
        super().save_model(request, obj, form, change)


@admin.register(Organizer)
class OrganizerAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'website_url',
        'order',
        'preview_logo',
    )
    search_fields = ('name', 'slug', 'website_url', 'description')
    list_filter = ()
    list_editable = ('order',)
    ordering = ('order', 'name')
    list_per_page = 25
    readonly_fields = ('preview_logo', 'created', 'modified', 'slug')
    fieldsets = (
        ("Basic Information", {
            "fields": ('name', 'slug', 'website_url', 'description', 'order'),
        }),
        ("Image", {
            "fields": ('logo', 'preview_logo'),
        }),
        ("Metadata", {
            "fields": ('created', 'modified'),
            "classes": ('collapse',),
        }),
    )

    @admin.display(description="Logo")
    def preview_logo(self, obj):
        return preview_image(obj.logo, obj.name, "Organizer Logo", (80, 200))


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'website_url',
        'order',
        'preview_logo',
        'event_count',
    )
    search_fields = ('name', 'slug', 'website_url', 'description')
    list_filter = ()
    list_editable = ('order',)
    ordering = ('order', 'name')
    list_per_page = 25
    readonly_fields = ('preview_logo', 'created', 'modified', 'slug',
                       'event_count')
    fieldsets = (
        ("Basic Information", {
            "fields": ('name', 'slug', 'website_url', 'description', 'order'),
        }),
        ("Image", {
            "fields": ('logo', 'preview_logo'),
        }),
        ("Usage", {
            "fields": ('event_count',),
        }),
        ("Metadata", {
            "fields": ('created', 'modified'),
            "classes": ('collapse',),
        }),
    )

    @admin.display(description="Logo")
    def preview_logo(self, obj):
        return preview_image(obj.logo, obj.name, "Partner Logo", (80, 200))

    @admin.display(description="Linked to events")
    def event_count(self, obj):
        try:
            count = obj.event_links.filter(is_deleted=False).count()
        except Exception:
            return 0
        if count == 0:
            return format_html('<span style="color:#999;">0</span>')
        return count


# Note: EventOrganizer, EventSideEvent, and EventPartner through-models
# are intentionally NOT registered as standalone admin pages.  They are
# managed exclusively through the Event inlines to avoid confusing
# duplicate entries in the admin sidebar (e.g. "Event organizers" vs
# "Organizers").
