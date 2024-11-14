from django.contrib import admin
from .models import Member, MemberBiography
import nested_admin


class MemberBiographyInline(nested_admin.NestedTabularInline):
    fields = ('description', 'order')
    model = MemberBiography
    extra = 0


@admin.register(Member)
class MemberAdmin(nested_admin.NestedModelAdmin):
    list_display = ("name", "title", "image_tag")
    readonly_fields = (
        "image_tag",
    )
    fields = (
        "name",
        "title",
        "about",
        "picture",
        "image_tag",
        "twitter",
        "linked_in",
        "order",
    )
    list_per_page = 10
    search_fields = ("name", "title")
    inlines = (MemberBiographyInline,)

    def image_tag(self, obj):
        width, height = 100, 200
        from django.utils.html import escape, format_html

        if obj.picture:
            return format_html(
                f'<img src="{escape(obj.get_picture_url())}" width="{width}" height="{height}" />'
            )
        return "No Image"

    image_tag.short_description = "Image Preview"
