"""Read-only public API for the website's staff-managed live-feed policy."""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.publications.models import LivePublicationFeedSettings
from ..serializers.live_publication_feed_settings import (
    LivePublicationFeedSettingsSerializer,
)


class LivePublicationFeedSettingsView(APIView):
    """Expose non-secret display policy; changes are made in Django admin."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        settings = LivePublicationFeedSettings.get_solo()
        if settings is None:
            response = Response(
                {"error": "Publication feed settings are not initialized."},
                status=503,
            )
            response["Cache-Control"] = "no-store"
            return response

        response = Response(LivePublicationFeedSettingsSerializer(settings).data)
        response["Cache-Control"] = "no-store"
        return response
