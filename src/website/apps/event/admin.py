from django.contrib import admin
import nested_admin
from django.utils.html import format_html
import logging

from django.core.exceptions import ValidationError  # Import ValidationError
# Import IntegrityError for database errors
from django.db import IntegrityError
from .models import Event, Inquiry, Program, Session, PartnerLogo, Resource

# Configure logger
logger = logging.getLogger(__name__)

# -------- Inline Classes --------


class InquiryInline(nested_admin.NestedTabularInline):
    model = Inquiry
    extra = 0
    sortable_field_name = 'order'
    fields = ('inquiry', 'role', 'email', 'order')
    ordering = ['order']


class PartnerLogoInline(nested_admin.NestedTabularInline):
    model = PartnerLogo
    extra = 0
    sortable_field_name = 'order'
    fields = ('name', 'partner_logo', 'order', 'preview_logo')
    readonly_fields = ('preview_logo',)

    def preview_logo(self, obj):
        return preview_image(obj.partner_logo, obj.name, "Partner Logo", (100, 150))

    preview_logo.short_description = "Preview Logo"


class ResourceInline(nested_admin.NestedTabularInline):
    model = Resource
    extra = 0
    fields = ('title', 'link', 'resource', 'order', 'download_link')
    readonly_fields = ('download_link',)

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

    download_link.short_description = "Resource Download Link"


class SessionInline(nested_admin.NestedTabularInline):
    model = Session
    extra = 0
    fields = ('session_title', 'start_time', 'end_time',
              'venue', 'session_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


class ProgramInline(nested_admin.NestedStackedInline):
    model = Program
    extra = 0
    fields = ('date', 'program_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']
    inlines = [SessionInline]


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
class EventAdmin(nested_admin.NestedModelAdmin):
    list_display = (
        'title',
        'start_date',
        'end_date',
        'website_category',
        'event_category',
        'order',
        'preview_event_image',
        'preview_background_image'
    )
    search_fields = ('title', 'location_name')
    list_editable = ('order',)
    ordering = ('order', '-start_date')
    list_per_page = 10
    readonly_fields = ('preview_event_image', 'preview_background_image')
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
            "fields": ('event_details', 'registration_link')
        }),
        ("Images", {
            "fields": ('event_image', 'preview_event_image', 'background_image', 'preview_background_image')
        }),
        ("Categorization", {
            "fields": ('website_category', 'event_category', 'event_tag', 'order')
        }),
    )

    def preview_event_image(self, obj):
        """Preview event image."""
        return preview_image(obj.event_image, obj.title, "Event Image", (150, 300))
    preview_event_image.short_description = "Event Image"

    def preview_background_image(self, obj):
        """Preview background image."""
        return preview_image(obj.background_image, obj.title, "Background Image", (150, 300))
    preview_background_image.short_description = "Background Image"

    def save_model(self, request, obj, form, change):
        """Override save_model to handle image uploads and database errors gracefully."""
        try:
            super().save_model(request, obj, form, change)
        except IntegrityError as ie:
            logger.error(
                f"Database integrity error saving Event '{obj.title}': {ie}")
            raise ValidationError(
                "A database error occurred. Please ensure all required fields are filled correctly."
            )
        except Exception as e:
            logger.error(f"Error saving Event '{obj.title}': {e}")
            raise ValidationError(
                "There was an error uploading the image. Please check that the file is a valid image and try again."
            )
