import logging
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly

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
        queryset = Event.objects.prefetch_related(
            'inquiries',
            'programs__sessions',
            'partner_logos',
            'resources'
        ).all()

        if category in ['airqo', 'cleanair']:
            queryset = queryset.filter(website_category=category)
            logger.info(
                f"Filtered Event queryset by category={category}, count={queryset.count()}")

        logger.info(f"Retrieved Event queryset, count={queryset.count()}")
        return queryset

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
