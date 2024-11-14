from django.contrib import admin
from .models import Tag, Highlight
from django.utils.html import format_html


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)


@admin.register(Highlight)
class HighlightAdmin(admin.ModelAdmin):
    list_display = ( 'title', 'display_tags', 'order', 'image_preview')
    list_filter = ('order', 'tags')
    search_fields = ('title', 'link', 'link_title')
    filter_horizontal = ('tags',)
    list_editable = ('order',)

    fields = ('title', 'image', 'link', 'link_title', 'order')
    list_per_page = 10

    def display_tags(self, obj):
        return ", ".join([tag.name for tag in obj.tags.all()])
    display_tags.short_description = 'Tags'

    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" width="150" height="auto" style="border-radius: 8px;" />',
                obj.image.url
            )
        return "No Image"
    image_preview.short_description = 'Image Preview'
