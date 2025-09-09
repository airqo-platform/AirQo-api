from rest_framework import viewsets
from .models import Press
from .serializers import PressSerializer
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from apps.api.v2.mixins import SlugModelViewSetMixin


class PressViewSet(SlugModelViewSetMixin, viewsets.ModelViewSet):
    queryset = Press.objects.all()  # Use the default queryset without soft delete
    serializer_class = PressSerializer
    lookup_field = 'id'
    permission_classes = [IsAuthenticatedOrReadOnly]  # Allow read-only access for unauthenticated users

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, modified_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(modified_by=self.request.user)

    def perform_destroy(self, instance):
        instance.delete()
