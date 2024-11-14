from django.contrib import admin
from .models import ExternalTeamMember, ExternalTeamMemberBiography
from django.utils.html import format_html


class ExternalTeamMemberBiographyInline(admin.TabularInline):
    model = ExternalTeamMemberBiography
    extra = 1
    fields = ['description', 'order']


@admin.register(ExternalTeamMember)
class ExternalTeamMemberAdmin(admin.ModelAdmin):
    list_display = ['name', 'title', 'order', 'image_preview']
    search_fields = ['name', 'title']
    list_filter = ['order']
    list_editable = ('order',)
    ordering = ['order', 'name']
    inlines = [ExternalTeamMemberBiographyInline]

    def image_preview(self, obj):
        if obj.picture:
            return format_html(f'<img src="{obj.get_picture_url()}" style="width: 50px; height: 50px;" />')
        return ""
    image_preview.short_description = "Picture Preview"

    def image_preview_detail(self, obj):
        if obj.picture:
            return format_html(f'<img src="{obj.get_picture_url()}" style="max-width: 300px; max-height: 300px;" />')
        return ""
    image_preview_detail.short_description = "Picture Preview"

    readonly_fields = ['image_preview_detail']

    fieldsets = (
        (None, {
            'fields': ('name', 'title', 'order', 'picture', 'twitter', 'linked_in')
        }),
        ('Image Preview', {
            'fields': ('image_preview_detail',),
            'classes': ('collapse',),
        }),
    )
