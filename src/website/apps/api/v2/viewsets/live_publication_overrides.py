"""Read-only API for metadata overrides managed in the Django admin."""

from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny

from apps.publications.models import LivePublicationOverride
from ..serializers.live_publication_overrides import (
    LivePublicationOverrideSerializer,
)


class LivePublicationOverrideViewSet(viewsets.ReadOnlyModelViewSet):
    """Return only requested overrides; writes remain restricted to Django admin."""

    serializer_class = LivePublicationOverrideSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response

    def get_queryset(self):
        identifiers = list(
            dict.fromkeys(self.request.query_params.getlist("identifier"))
        )
        if len(identifiers) > 100 or any(len(identifier) > 255 for identifier in identifiers):
            raise ValidationError(
                {
                    "identifier": (
                        "At most 100 identifiers may be requested and each must be "
                        "255 characters or fewer."
                    )
                }
            )

        if not identifiers:
            return LivePublicationOverride.objects.none()

        return LivePublicationOverride.objects.filter(
            external_identifier__in=identifiers
        )
