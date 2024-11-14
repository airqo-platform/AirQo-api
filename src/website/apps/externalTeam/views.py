# externalTeam/views.py

from rest_framework import viewsets
from .models import ExternalTeamMember
from .serializers import ExternalTeamMemberSerializer


class ExternalTeamMemberViewSet(viewsets.ReadOnlyModelViewSet):
    """
    A ViewSet for listing or retrieving external team members.
    """
    queryset = ExternalTeamMember.objects.all().order_by('order')
    serializer_class = ExternalTeamMemberSerializer
