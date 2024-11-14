from django.contrib import admin
from django.utils.html import format_html
from .models import Press
import cloudinary.uploader


@admin.register(Press)
class PressAdmin(admin.ModelAdmin):
    list_display = ('article_title', 'date_published', 'website_category', 'image_preview', 'order')
    list_filter = ('website_category', 'date_published')
    search_fields = ('article_title', 'article_intro', 'article_link')
    ordering = ('order', '-date_published')
    list_editable = ('order',)
    readonly_fields = ('image_preview',)

    fieldsets = (
        (None, {
            'fields': ('article_title', 'article_intro', 'article_link', 'date_published', 'publisher_logo', 'website_category', 'order', 'image_preview')
        }),
    )

    def image_preview(self, obj):
        if obj.publisher_logo:
            return format_html('<img src="{}" width="150" height="150" />', obj.publisher_logo.url)
        return "No image available"

    image_preview.short_description = 'Image Preview'

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            if obj.publisher_logo:
                public_id = obj.publisher_logo.public_id
                if public_id:
                    cloudinary.uploader.destroy(public_id)
            obj.delete()
