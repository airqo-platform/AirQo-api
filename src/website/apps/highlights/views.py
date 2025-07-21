# views.py

from rest_framework import viewsets, permissions
from .models import Tag, Highlight
from .serializers import TagSerializer, HighlightSerializer


class TagViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing Tag instances.
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


class HighlightViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing Highlight instances.
    """
    queryset = Highlight.objects.all()
    serializer_class = HighlightSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    ordering_fields = ['order', 'id']
    ordering = ['order', '-id']
