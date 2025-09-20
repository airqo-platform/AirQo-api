from django.contrib import admin
from .models import Tag, Highlight  # Correctly import the Tag model
from django.utils.html import format_html


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    """
    Admin configuration for Tag model.
    """
    list_display = ('id', 'name')
    search_fields = ('name',)


@admin.register(Highlight)
class HighlightAdmin(admin.ModelAdmin):
    """
    Admin configuration for Highlight model.
    """
    list_display = ('title', 'display_tags', 'order', 'image_preview')
    list_filter = ('order', 'tags')
    search_fields = ('title', 'link', 'link_title')
    filter_horizontal = ('tags',)
    list_editable = ('order',)
    list_per_page = 10
    fields = ('title', 'tags', 'image', 'link', 'link_title', 'order')

    @admin.display(description='Tags')
    def display_tags(self, obj):
        """
        Display tags in a comma-separated format.
        """
        return ", ".join([tag.name for tag in obj.tags.all()])

    @admin.display(description='Image Preview')
    def image_preview(self, obj):
        """
        Show a preview of the image in the admin list view.
        """
        if obj.image:
            return format_html(
                '<img src="{}" width="150" height="auto" style="border-radius: 8px;" />',
                obj.image.url
            )
        return "No Image"
