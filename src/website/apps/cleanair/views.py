# views.py
from rest_framework import generics
from rest_framework import viewsets
from django.http import Http404
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import CleanAirResource, ForumEvent
from .serializers import CleanAirResourceSerializer, ForumEventSerializer, ForumEventTitleSerializer


class CleanAirResourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CleanAirResource.objects.all()
    serializer_class = CleanAirResourceSerializer
    permission_classes = [AllowAny]


class ForumEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ForumEvent.objects.prefetch_related(
        'persons', 'programs', 'partners', 'forum_resources'
    ).all()
    serializer_class = ForumEventSerializer
    permission_classes = [AllowAny]

    # Use unique_title for lookups
    lookup_field = 'unique_title'
    # Optionally, you can set a regex if necessary:
    # lookup_value_regex = '[^/]+'

    def retrieve(self, request, *args, **kwargs):
        slug = self.kwargs.get(self.lookup_field)
        if slug == 'latest':
            # Return the latest forum event. For example, using the highest id:
            instance = ForumEvent.objects.prefetch_related(
                'persons', 'programs', 'partners', 'forum_resources'
            ).order_by('-id').first()
            if instance is None:
                raise Http404("No forum event found.")
        else:
            instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class ForumEventTitlesView(generics.ListAPIView):
    # Include all fields used in the lightweight serializer to avoid extra queries
    queryset = ForumEvent.objects.all().only(
        'id', 'title', 'unique_title', 'background_image',
        'start_date', 'end_date', 'start_time', 'end_time', 'location_name'
    )
    serializer_class = ForumEventTitleSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'forum_events': serializer.data
        })
