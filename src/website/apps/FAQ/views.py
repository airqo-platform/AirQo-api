from rest_framework import viewsets
from .models import FAQ
from .serializers import FAQSerializer

# FAQ ViewSet


class FAQViewSet(viewsets.ModelViewSet):
    queryset = FAQ.objects.all()
    serializer_class = FAQSerializer
