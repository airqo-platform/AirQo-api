# views.py
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from .models import CleanAirResource, ForumEvent
from .serializers import CleanAirResourceSerializer, ForumEventSerializer


class CleanAirResourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CleanAirResource.objects.all()
    serializer_class = CleanAirResourceSerializer
    permission_classes = [AllowAny]


class ForumEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumEvent.objects.prefetch_related(
        'persons', 'programs', 'partners', 'forum_resources').all()
    serializer_class = ForumEventSerializer
    permission_classes = [AllowAny]
