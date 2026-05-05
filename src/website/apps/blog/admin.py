from django.contrib import admin
from django.utils.html import format_html

from utils.cloudinary import safe_destroy

from .models import BlogPost


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'published_at',
        'website_category',
        'is_published',
        'order',
        'author_image_preview',
        'cover_image_preview',
    )
    list_filter = ('website_category', 'is_published', 'published_at')
    search_fields = ('title', 'summary', 'author_name', 'author_role', 'meta_title')
    ordering = ('order', '-published_at', '-id')
    list_editable = ('order', 'is_published')
    readonly_fields = ('slug', 'created', 'modified', 'author_image_preview', 'cover_image_preview')

    fieldsets = (
        (None, {
            'fields': ('title', 'slug', 'summary', 'author_name', 'author_role')
        }),
        ('Author Media', {
            'fields': ('author_image', 'author_image_preview'),
        }),
        ('Content', {
            'fields': ('content',),
        }),
        ('SEO Metadata', {
            'fields': ('meta_title', 'meta_description'),
        }),
        ('Publishing', {
            'fields': ('published_at', 'is_published', 'website_category', 'order'),
        }),
        ('Media', {
            'fields': ('cover_image', 'cover_image_preview'),
        }),
        ('Metadata', {
            'fields': ('created', 'modified'),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Cover Image')
    def cover_image_preview(self, obj):
        if obj.cover_image:
            return format_html(
                '<img src="{}" width="160" height="100" style="object-fit:cover;border-radius:8px;" />',
                obj.cover_image.url,
            )
        return 'No image available'

    @admin.display(description='Author Image')
    def author_image_preview(self, obj):
        if obj.author_image:
            return format_html(
                '<img src="{}" width="100" height="100" style="object-fit:cover;border-radius:50%;" />',
                obj.author_image.url,
            )
        return 'No image available'

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            safe_destroy(obj.author_image, invalidate=True)
            safe_destroy(obj.cover_image, invalidate=True)
            obj.delete()