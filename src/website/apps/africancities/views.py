from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from .models import AfricanCountry
from .serializers import AfricanCitySerializer


class AfricanCityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AfricanCountry.objects.all()
    serializer_class = AfricanCitySerializer
    permission_classes = [AllowAny]
