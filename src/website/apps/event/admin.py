from django.contrib import admin
import nested_admin
from .models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from django.utils.html import format_html
from django import forms
from django_quill.fields import QuillFormField

# -------- Custom Forms for Quill Integration --------


class ProgramInlineForm(forms.ModelForm):
    """Custom form for Program Inline with Quill editor."""
    program_details = QuillFormField()

    class Meta:
        model = Program
        fields = '__all__'


class SessionInlineForm(forms.ModelForm):
    """Custom form for Session Inline with Quill editor."""
    session_details = QuillFormField()

    class Meta:
        model = Session
        fields = '__all__'

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
        if obj.partner_logo and obj.partner_logo.url:
            return format_html(
                '<img src="{}" style="max-height: 100px; max-width: 150px;" alt="Partner Logo"/>',
                obj.partner_logo.url
            )
        return "No logo uploaded"

    preview_logo.short_description = "Preview Logo"


class ResourceInline(nested_admin.NestedTabularInline):
    """Inline admin for resources with download links."""
    model = Resource
    extra = 0
    fields = ('title', 'link', 'resource', 'order', 'download_link')
    readonly_fields = ('download_link',)

    def download_link(self, obj):
        """Generate a download link for resources."""
        if obj.resource and obj.resource.url:
            return format_html('<a href="{}" target="_blank">Download</a>', obj.resource.url)
        return "No resource uploaded"

    download_link.short_description = "Resource Download Link"


class SessionInline(nested_admin.NestedTabularInline):
    """Inline admin for sessions with Quill editor."""
    model = Session
    form = SessionInlineForm
    extra = 0
    fields = ('session_title', 'start_time', 'end_time',
              'venue', 'session_details', 'order')
    sortable_field_name = 'order'
    ordering = ['order']


class ProgramInline(nested_admin.NestedStackedInline):
    """Inline admin for programs with nested sessions."""
    model = Program
    form = ProgramInlineForm
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

    def preview_event_image(self, obj):
        """Preview event image."""
        if obj.event_image and obj.event_image.url:
            return format_html(
                '<img src="{}" style="max-height: 150px; max-width: 300px;" alt="Event Image"/>',
                obj.event_image.url
            )
        return "No image uploaded"

    preview_event_image.short_description = "Event Image Preview"
