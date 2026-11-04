"""Public, non-secret publication-feed policy returned to the website server."""

from rest_framework import serializers

from apps.publications.models import LivePublicationFeedSettings


class LivePublicationFeedSettingsSerializer(serializers.ModelSerializer):
    openalex_author_ids = serializers.SerializerMethodField()
    allowed_affiliations = serializers.SerializerMethodField()
    relevance_keywords = serializers.SerializerMethodField()

    def get_openalex_author_ids(self, obj):
        return obj.openalex_author_id_list

    def get_allowed_affiliations(self, obj):
        return obj.allowed_affiliation_list

    def get_relevance_keywords(self, obj):
        return obj.relevance_keyword_list

    class Meta:
        model = LivePublicationFeedSettings
        fields = [
            "enabled",
            "openalex_author_ids",
            "allowed_affiliations",
            "relevance_keywords",
            "relevance_required",
            "openalex_api_url",
            "crossref_api_url",
            "crossref_mailto",
            "updated_at",
        ]
