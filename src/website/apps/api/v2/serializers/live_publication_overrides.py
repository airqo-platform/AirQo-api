"""Serializers for staff-curated external live-publication metadata."""

from rest_framework import serializers

from apps.publications.models import LivePublicationOverride


class LivePublicationOverrideSerializer(serializers.ModelSerializer):
    authors = serializers.SerializerMethodField()

    def get_authors(self, obj):
        return [
            author.strip()
            for author in obj.authors.splitlines()
            if author.strip()
        ]

    class Meta:
        model = LivePublicationOverride
        fields = ["external_identifier", "authors", "journal"]
