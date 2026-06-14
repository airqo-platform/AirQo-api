import logging
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Event, Inquiry, Program, Session, PartnerLogo, Resource
from .serializers import (
    EventListSerializer,
    EventDetailSerializer,
    InquirySerializer,
    ProgramSerializer,
    SessionSerializer,
    PartnerLogoSerializer,
    ResourceSerializer,
)

logger = logging.getLogger(__name__)


class EventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    A viewset that provides the standard actions for the Event model.
    """
    permission_classes = [IsAuthenticatedOrReadOnly]
    lookup_field = 'id'
    filter_backends = [OrderingFilter]
    ordering_fields = ['order', 'start_date', 'end_date', 'title', 'created']
    ordering = ['order', '-start_date']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            serializer_class = EventDetailSerializer
        else:
            serializer_class = EventListSerializer
        logger.debug(
            f"Selected serializer_class={serializer_class.__name__} for action={self.action}")
        return serializer_class

    def get_queryset(self):
        category = self.request.query_params.get('category', None)
        logger.debug(f"Fetching Event queryset with category={category}")
        queryset = Event.objects.filter(is_deleted=False).prefetch_related(
            'inquiries',
            'programs__sessions',
            'partner_logos',
            'resources',
            'event_organizer_links__organizer',
            'side_event_links__side_event',
            'parent_event_links__parent_event',
        ).order_by('order', '-start_date')

        if category in ['airqo', 'cleanair']:
            queryset = queryset.filter(website_category=category)
            logger.info(
                f"Filtered Event queryset by category={category}, count={queryset.count()}")

        logger.info(f"Retrieved Event queryset, count={queryset.count()}")
        return queryset

    @action(detail=False, methods=['get'])
    def featured(self, request, *args, **kwargs):
        """Return featured events without changing the existing list endpoint."""
        queryset = self.get_queryset().filter(event_tag=Event.EventTag.FEATURED)
        queryset = self.filter_queryset(queryset)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        logger.debug("Handling Event list request")
        response = super().list(request, *args, **kwargs)
        logger.info(f"Listed Events, returned {len(response.data)} records")
        return response

    def retrieve(self, request, *args, **kwargs):
        logger.debug(f"Handling Event retrieve request, id={kwargs.get('id')}")
        response = super().retrieve(request, *args, **kwargs)
        logger.info(f"Retrieved Event detail for ID={kwargs.get('id')}")
        return response


class InquiryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Inquiry.objects.select_related('event').all()
    serializer_class = InquirySerializer
    lookup_field = 'id'

    def list(self, request, *args, **kwargs):
        logger.debug("Handling Inquiry list request")
        response = super().list(request, *args, **kwargs)
        logger.info(f"Listed Inquiries, returned {len(response.data)} records")
        return response

    def retrieve(self, request, *args, **kwargs):
        logger.debug(
            f"Handling Inquiry retrieve request, id={kwargs.get('id')}")
        response = super().retrieve(request, *args, **kwargs)
        logger.info(f"Retrieved Inquiry detail for ID={kwargs.get('id')}")
        return response


class ProgramViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Program.objects.select_related(
        'event').prefetch_related('sessions').all()
    serializer_class = ProgramSerializer
    lookup_field = 'id'

    def list(self, request, *args, **kwargs):
        logger.debug("Handling Program list request")
        response = super().list(request, *args, **kwargs)
        logger.info(f"Listed Programs, returned {len(response.data)} records")
        return response

    def retrieve(self, request, *args, **kwargs):
        logger.debug(
            f"Handling Program retrieve request, id={kwargs.get('id')}")
        response = super().retrieve(request, *args, **kwargs)
        logger.info(f"Retrieved Program detail for ID={kwargs.get('id')}")
        return response


class SessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Session.objects.select_related('program__event').all()
    serializer_class = SessionSerializer
    lookup_field = 'id'

    def list(self, request, *args, **kwargs):
        logger.debug("Handling Session list request")
        response = super().list(request, *args, **kwargs)
        logger.info(f"Listed Sessions, returned {len(response.data)} records")
        return response

    def retrieve(self, request, *args, **kwargs):
        logger.debug(
            f"Handling Session retrieve request, id={kwargs.get('id')}")
        response = super().retrieve(request, *args, **kwargs)
        logger.info(f"Retrieved Session detail for ID={kwargs.get('id')}")
        return response


class PartnerLogoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PartnerLogo.objects.select_related('event').all()
    serializer_class = PartnerLogoSerializer
    lookup_field = 'id'

    def list(self, request, *args, **kwargs):
        logger.debug("Handling PartnerLogo list request")
        response = super().list(request, *args, **kwargs)
        logger.info(
            f"Listed PartnerLogos, returned {len(response.data)} records")
        return response

    def retrieve(self, request, *args, **kwargs):
        logger.debug(
            f"Handling PartnerLogo retrieve request, id={kwargs.get('id')}")
        response = super().retrieve(request, *args, **kwargs)
        logger.info(f"Retrieved PartnerLogo detail for ID={kwargs.get('id')}")
        return response


class ResourceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Resource.objects.select_related('event').all()
    serializer_class = ResourceSerializer
    lookup_field = 'id'

    def list(self, request, *args, **kwargs):
        logger.debug("Handling Resource list request")
        response = super().list(request, *args, **kwargs)
        logger.info(f"Listed Resources, returned {len(response.data)} records")
        return response

    def retrieve(self, request, *args, **kwargs):
        logger.debug(
            f"Handling Resource retrieve request, id={kwargs.get('id')}")
        response = super().retrieve(request, *args, **kwargs)
        logger.info(f"Retrieved Resource detail for ID={kwargs.get('id')}")
        return response
