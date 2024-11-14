from rest_framework import viewsets
from rest_framework.response import Response
from .models import ImpactNumber
from .serializers import ImpactNumberSerializer

class ImpactNumberViewSet(viewsets.ViewSet):
    """
    A ViewSet to retrieve the single instance of ImpactNumber.
    """

    def list(self, request):
        impact_number = ImpactNumber.objects.first()
        if not impact_number:
            return Response({"detail": "No Impact Number data found."}, status=404)
        serializer = ImpactNumberSerializer(impact_number)
        return Response(serializer.data)
