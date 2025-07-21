# views.py

from django.utils import translation
from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from .models import Partner
from .serializers import PartnerSerializer


class PartnerViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    queryset = Partner.objects.all()
    serializer_class = PartnerSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        language = self.request.session.get(
            'django_language') or self.request.COOKIES.get('django_language')
        if language:
            translation.activate(language)
        return queryset

    def retrieve(self, request, *args, **kwargs):
        # Overriding retrieve to ensure lookup by default primary key
        return super().retrieve(request, *args, **kwargs)
