from django.contrib import admin
from .models import Member, MemberBiography
import nested_admin
from django.utils.html import format_html


class MemberBiographyInline(nested_admin.NestedTabularInline):
    fields = ('description', 'order')
    model = MemberBiography
    extra = 0


@admin.register(Member)
class MemberAdmin(nested_admin.NestedModelAdmin):
    list_display = ("name", "title", "image_tag")
    readonly_fields = ("image_tag",)
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
        if obj.picture:
            return format_html(
                '<img src="{}" width="100" height="200" style="object-fit: contain;" />',
                obj.get_picture_url()
            )
        return "No Image"

    image_tag.short_description = "Image Preview"
