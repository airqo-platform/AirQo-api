from django.contrib import admin
import nested_admin
from .models import Partner, PartnerDescription


class PartnerDescriptionInline(nested_admin.NestedTabularInline):
    fields = ('description', 'order')
    model = PartnerDescription
    extra = 0


@admin.register(Partner)
class PartnerAdmin(nested_admin.NestedModelAdmin):
    list_display = ('partner_name', 'website_category', 'type_display', 'logo_preview', 'image_preview')
    list_filter = ('website_category', 'type',)
    fields = (
        'partner_name',
        'website_category',
        'type',
        'partner_logo',
        'partner_image',
        'partner_link',
        'order'
    )
    list_per_page = 10
    search_fields = ('partner_name', 'type')
    inlines = (PartnerDescriptionInline,)

    def type_display(self, obj):
        return obj.get_type_display()

    def logo_preview(self, obj):
        width, height = 65, 50
        from django.utils.html import escape, format_html
        if obj.partner_logo:
            return format_html(f'<img src="{escape(obj.partner_logo.url)}" width="{width}" height="{height}" />')
        return "No Logo"

    logo_preview.short_description = "Logo"

    def image_preview(self, obj):
        width, height = 120, 80
        from django.utils.html import escape, format_html
        if obj.partner_image:
            return format_html(f'<img src="{escape(obj.partner_image.url)}" width="{width}" height="{height}" />')
        return "No Image"

    image_preview.short_description = "Image"
