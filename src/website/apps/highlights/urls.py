# urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TagViewSet, HighlightViewSet

router = DefaultRouter()
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'highlights', HighlightViewSet, basename='highlight')

urlpatterns = [
    path('', include(router.urls)),
]
