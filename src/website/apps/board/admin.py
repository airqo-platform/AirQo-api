from django.contrib import admin
from .models import BoardMember, BoardMemberBiography
import nested_admin


class BoardMemberBiographyInline(nested_admin.NestedTabularInline):
    fields = ('description', 'order')
    model = BoardMemberBiography
    extra = 0


@admin.register(BoardMember)
class BoardMemberAdmin(nested_admin.NestedModelAdmin):
    list_display = ("name", "title", "image_tag")
    readonly_fields = (
        "id",
        "image_tag",
    )
    fields = (
        "id",
        "name",
        "title",
        "picture",
        "image_tag",
        "twitter",
        "linked_in",
        "order",
    )
    list_per_page = 10
    search_fields = ("name", "title")
    inlines = (BoardMemberBiographyInline,)

    def image_tag(self, obj):
        width, height = 100, 200
        from django.utils.html import format_html

        if obj.picture:
            return format_html(f'<img src="{obj.get_picture_url()}" height="{height}" />')
        return '-'

    image_tag.short_description = "Image Preview"
