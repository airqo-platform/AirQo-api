
from django.contrib import admin
import nested_admin
from .models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from django.utils.html import format_html
import logging

# Configure logger
logger = logging.getLogger(__name__)

# -------- Inline Classes --------


class InquiryInline(nested_admin.NestedTabularInline):
    """Inline admin for inquiries."""
    model = Inquiry
    extra = 0
    sortable_field_name = 'order'
    fields = ('inquiry', 'role', 'email', 'order')
    ordering = ['order']


class PartnerLogoInline(nested_admin.NestedTabularInline):
    """Inline admin for partner logos with logo preview."""
    model = PartnerLogo
    extra = 0
    sortable_field_name = 'order'
    fields = ('name', 'partner_logo', 'order', 'preview_logo')
    readonly_fields = ('preview_logo',)

    def preview_logo(self, obj):
        """Preview partner logo."""
        if obj.partner_logo and hasattr(obj.partner_logo, 'url'):
            try:
                return format_html(
                    '<img src="{}" style="max-height: 100px; max-width: 150px;" alt="Partner Logo"/>',
                    obj.partner_logo.url
                )
            except Exception as e:
                logger.error(
                    f"Error loading partner_logo for Partner '{obj.name}': {e}")
                return "Error loading logo."
        elif isinstance(obj.partner_logo, str) and obj.partner_logo:
            # Handle cases where partner_logo is a string path
            try:
                return format_html(
                    '<img src="{}" style="max-height: 100px; max-width: 150px;" alt="Partner Logo"/>',
                    obj.partner_logo
                )
            except Exception as e:
                logger.error(
                    f"Error loading partner_logo path for Partner '{obj.name}': {e}")
                return "Error loading logo."
        return "No logo uploaded."

    preview_logo.short_description = "Preview Logo"


class ResourceInline(nested_admin.NestedTabularInline):
    """Inline admin for resources with download links."""
    model = Resource
    extra = 0
    fields = ('title', 'link', 'resource', 'order', 'download_link')
    readonly_fields = ('download_link',)

    def download_link(self, obj):
        """Generate a download link for resources."""
        if obj.resource and hasattr(obj.resource, 'url'):
            try:
                return format_html('<a href="{}" target="_blank">Download</a>', obj.resource.url)
            except Exception as e:
                logger.error(
                    f"Error generating download link for Resource '{obj.title}': {e}")
                return "Error generating link."
        elif isinstance(obj.resource, str) and obj.resource:
            # Handle cases where resource is a string path
            try:
                return format_html('<a href="{}" target="_blank">Download</a>', obj.resource)
            except Exception as e:
                logger.error(
                    f"Error generating download link path for Resource '{obj.title}': {e}")
                return "Error generating link."
        return "No resource uploaded."

    download_link.short_description = "Resource Download Link"


class SessionInline(nested_admin.NestedTabularInline):
    """Inline admin for sessions."""
    model = Session
    extra = 0
    fields = ('session_title', 'start_time', 'end_time',
              'venue', 'session_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


class ProgramInline(nested_admin.NestedStackedInline):
    """Inline admin for programs with nested sessions."""
    model = Program
    extra = 0
    fields = ('date', 'program_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']
    inlines = [SessionInline]


# -------- Event Admin --------

@admin.register(Event)
class EventAdmin(nested_admin.NestedModelAdmin):
    """Admin configuration for the Event model."""
    list_display = (
        'title',
        'start_date',
        'end_date',
        'website_category',
        'event_category',
        'order',
        'preview_event_image',
    )
    search_fields = ('title', 'location_name')
    list_editable = ('order',)
    ordering = ('order', '-start_date')
    list_per_page = 10
    readonly_fields = ('preview_event_image',)
    inlines = [
        InquiryInline,
        ProgramInline,
        PartnerLogoInline,
        ResourceInline
    ]
    fieldsets = (
        ("Basic Information", {
            "fields": ('title', 'title_subtext', 'start_date', 'end_date', 'start_time', 'end_time')
        }),
        ("Location", {
            "fields": ('location_name', 'location_link')
        }),
        ("Details", {
            "fields": ('event_details', 'registration_link', 'event_image', 'background_image')
        }),
        ("Categorization", {
            "fields": ('website_category', 'event_category', 'event_tag', 'order')
        }),
    )

    def preview_event_image(self, obj):
        """Preview event image."""
        if obj.event_image and hasattr(obj.event_image, 'url'):
            try:
                return format_html(
                    '<img src="{}" style="max-height: 150px; max-width: 300px;" alt="Event Image"/>',
                    obj.event_image.url
                )
            except Exception as e:
                logger.error(
                    f"Error loading event_image for Event '{obj.title}': {e}")
                return "Error loading image."
        elif isinstance(obj.event_image, str) and obj.event_image:
            # Handle cases where event_image is a string path
            try:
                return format_html(
                    '<img src="{}" style="max-height: 150px; max-width: 300px;" alt="Event Image"/>',
                    obj.event_image
                )
            except Exception as e:
                logger.error(
                    f"Error loading event_image path for Event '{obj.title}': {e}")
                return "Error loading image."
        return "No image uploaded."

    preview_event_image.short_description = "Event Image Preview"
