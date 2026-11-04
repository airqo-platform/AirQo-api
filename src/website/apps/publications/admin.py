from django.contrib import admin

from .models import (
    LivePublicationFeedSettings,
    Publication,
)
from .forms import LivePublicationFeedSettingsAdminForm


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "order"]
    search_fields = ["title", "category"]
    list_filter = ["category"]
    list_editable = ["order"]
    ordering = ["order", "-id"]
    list_per_page = 10


@admin.register(LivePublicationFeedSettings)
class LivePublicationFeedSettingsAdmin(admin.ModelAdmin):
    form = LivePublicationFeedSettingsAdminForm
    list_display = [
        "feed_name",
        "live_on_website",
        "relevance_filter",
        "updated_at",
    ]
    list_display_links = ["feed_name"]
    readonly_fields = ["updated_at"]
    fieldsets = [
        (
            "Website behaviour",
            {
                "fields": ["enabled"],
                "description": (
                    "Use this switch to pause or resume provider-supplied "
                    "AirQo publications. Existing curated publications are not removed."
                ),
            },
        ),
        (
            "Which AirQo publications should appear",
            {
                "fields": [
                    "openalex_author_ids",
                    "allowed_affiliations",
                    "relevance_keywords",
                    "relevance_required",
                ]
            },
        ),
        (
            "Technical provider settings (advanced)",
            {
                "fields": [
                    "openalex_api_url",
                    "crossref_api_url",
                    "crossref_mailto",
                ],
                "classes": ["collapse"],
                "description": (
                    "These values normally stay unchanged. API keys are never "
                    "stored in this form."
                ),
            },
        ),
        ("Audit", {"fields": ["updated_at"]}),
    ]
    list_per_page = 1
    actions = None

    @admin.display(description="Publication feed")
    def feed_name(self, obj):
        return "AirQo research publications"

    @admin.display(boolean=True, description="Published live")
    def live_on_website(self, obj):
        return obj.enabled

    @admin.display(boolean=True, description="Uses relevance filter")
    def relevance_filter(self, obj):
        return obj.relevance_required

    def has_add_permission(self, request):
        return (
            super().has_add_permission(request)
            and not LivePublicationFeedSettings.objects.exists()
        )

    def has_delete_permission(self, request, obj=None):
        return False
