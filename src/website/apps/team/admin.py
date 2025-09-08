from django.contrib import admin
from django.utils.html import format_html
from django.contrib.admin import AdminSite
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from nested_admin import NestedTabularInline, NestedModelAdmin  # type: ignore
else:
    try:
        from nested_admin import NestedTabularInline, NestedModelAdmin  # type: ignore
    except Exception:
        NestedTabularInline = admin.TabularInline  # type: ignore
        NestedModelAdmin = admin.ModelAdmin  # type: ignore

from .models import Member, MemberBiography
from apps.externalteams.models import ExternalTeamMember, ExternalTeamMemberBiography


class MemberBiographyInline(NestedTabularInline):
    fields = ('description', 'order')
    model = MemberBiography
    extra = 0
    verbose_name = "Biography/Description"
    verbose_name_plural = "Biographies/Descriptions"


class ExternalTeamMemberBiographyInline(admin.TabularInline):
    model = ExternalTeamMemberBiography
    extra = 0
    fields = ['description', 'order']
    verbose_name = "Biography/Description"
    verbose_name_plural = "Biographies/Descriptions"


@admin.register(Member)
class MemberAdmin(NestedModelAdmin):
    """Enhanced Team Member Admin with improved organization"""

    list_display = ("name_with_title", "role_badge",
                    "social_links", "image_preview", "order")
    list_filter = ("title", "created", "modified")
    search_fields = ("name", "title", "about")
    list_per_page = 20
    list_editable = ("order",)
    ordering = ["order", "name"]
    date_hierarchy = "created"

    readonly_fields = ("image_preview_large", "created", "modified", "id")
    inlines = (MemberBiographyInline,)

    actions = ["reset_order", "export_team_data"]

    fieldsets = (
        ("Team Member Information", {
            "fields": ("name", "title", "about", "order"),
            "classes": ("wide",)
        }),
        ("Profile Picture", {
            "fields": ("picture", "image_preview_large"),
            "classes": ("wide",)
        }),
        ("Social Media", {
            "fields": ("twitter", "linked_in"),
            "classes": ("collapse",)
        }),
        ("System Information", {
            "fields": ("id", "created", "modified"),
            "classes": ("collapse",)
        }),
    )

    @admin.display(description="Name & Title")
    def name_with_title(self, obj):
        """Display name with title and character count"""
        name = obj.name or "No Name"
        title = obj.title or "No Title"
        return format_html(
            '<strong>{}</strong><br><span style="color: #666; font-size: 0.9em;">{}</span>',
            name, title
        )

    @admin.display(description="Role")
    def role_badge(self, obj):
        """Show role as a colored badge"""
        title = obj.title or "No Title"

        # Color coding based on role keywords
        color_map = {
            'engineer': '#007cba',
            'scientist': '#28a745',
            'manager': '#dc3545',
            'director': '#6f42c1',
            'lead': '#fd7e14',
            'coordinator': '#20c997'
        }

        color = '#6c757d'  # default gray
        for keyword, role_color in color_map.items():
            if keyword in title.lower():
                color = role_color
                break

        return format_html(
            '<span class="badge" style="background: {}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">{}</span>',
            color, title
        )

    @admin.display(description="Social")
    def social_links(self, obj):
        """Show social media links with icons"""
        links = []
        if obj.twitter:
            links.append(format_html(
                '<a href="{}" target="_blank" title="Twitter">🐦</a>', obj.twitter))
        if obj.linked_in:
            links.append(format_html(
                '<a href="{}" target="_blank" title="LinkedIn">💼</a>', obj.linked_in))

        if links:
            return format_html(' '.join(links))
        return format_html('<span style="color: #ccc;">—</span>')

    @admin.display(description="Photo")
    def image_preview(self, obj):
        """Small image preview for list view"""
        if obj.picture:
            try:
                return format_html(
                    '<img src="{}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #ddd;" />',
                    obj.get_picture_url()
                )
            except:
                return format_html('<span style="color: red;">Error</span>')
        return format_html('<div style="width: 40px; height: 40px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">No Img</div>')

    @admin.display(description="Picture Preview")
    def image_preview_large(self, obj):
        """Large image preview for detail view"""
        if obj.picture:
            try:
                return format_html(
                    '<img src="{}" style="max-width: 200px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />',
                    obj.get_picture_url()
                )
            except:
                return format_html('<span style="color: red;">Error loading image</span>')
        return format_html('<span style="color: #ccc;">No image uploaded</span>')

    # Bulk actions

    @admin.action(description="Reset order (alphabetically)")
    def reset_order(self, request, queryset):
        """Reset order for selected members"""
        for i, member in enumerate(queryset.order_by('name'), 1):
            member.order = i
            member.save()
        count = queryset.count()
        self.message_user(request, f'Order reset for {count} team members.')

    @admin.action(description="Export team data")
    def export_team_data(self, request, queryset):
        """Export team data"""
        count = queryset.count()
        self.message_user(request, f'Team data exported for {count} members.')


class ExternalTeamMemberAdmin(admin.ModelAdmin):
    """External Team Members - organized under Team category"""

    list_display = ['name_with_title', 'role_badge',
                    'social_links', 'image_preview', 'order']
    search_fields = ['name', 'title']
    list_filter = ['title', 'order']
    list_editable = ('order',)
    ordering = ['order', 'name']
    list_per_page = 20

    inlines = [ExternalTeamMemberBiographyInline]
    readonly_fields = ['image_preview_large', 'created', 'modified', 'id']

    fieldsets = (
        ("External Team Member Information", {
            'fields': ('name', 'title', 'order'),
            'classes': ('wide',)
        }),
        ("Profile Picture", {
            'fields': ('picture', 'image_preview_large'),
            'classes': ('wide',)
        }),
        ("Social Media", {
            'fields': ('twitter', 'linked_in'),
            'classes': ('collapse',)
        }),
        ("System Information", {
            'fields': ('id', 'created', 'modified'),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description="Name & Title")
    def name_with_title(self, obj):
        """Display name with title"""
        name = obj.name or "No Name"
        title = obj.title or "External Member"
        return format_html(
            '<strong>{}</strong><br><span style="color: #666; font-size: 0.9em;">🌐 {}</span>',
            name, title
        )

    @admin.display(description="Role")
    def role_badge(self, obj):
        """Show role as external badge"""
        title = obj.title or "External Member"
        return format_html(
            '<span class="badge" style="background: #17a2b8; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">🌐 {}</span>',
            title
        )

    @admin.display(description="Social")
    def social_links(self, obj):
        """Show social media links"""
        links = []
        if obj.twitter:
            links.append(format_html(
                '<a href="{}" target="_blank" title="Twitter">🐦</a>', obj.twitter))
        if obj.linked_in:
            links.append(format_html(
                '<a href="{}" target="_blank" title="LinkedIn">💼</a>', obj.linked_in))

        if links:
            return format_html(' '.join(links))
        return format_html('<span style="color: #ccc;">—</span>')

    @admin.display(description="Photo")
    def image_preview(self, obj):
        """Small image preview for list view"""
        if obj.picture:
            try:
                return format_html(
                    '<img src="{}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #17a2b8;" />',
                    obj.get_picture_url()
                )
            except:
                return format_html('<span style="color: red;">Error</span>')
        return format_html('<div style="width: 40px; height: 40px; border-radius: 50%; background: #e1f7fa; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #17a2b8;">Ext</div>')

    @admin.display(description="Picture Preview")
    def image_preview_large(self, obj):
        """Large image preview for detail view"""
        if obj.picture:
            try:
                return format_html(
                    '<img src="{}" style="max-width: 200px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />',
                    obj.get_picture_url()
                )
            except:
                return format_html('<span style="color: red;">Error loading image</span>')
        return format_html('<span style="color: #ccc;">No image uploaded</span>')


# Unregister any existing admin and register our ExternalTeamMemberAdmin
try:
    admin.site.unregister(ExternalTeamMember)
except admin.sites.NotRegistered:
    pass

admin.site.register(ExternalTeamMember, ExternalTeamMemberAdmin)
