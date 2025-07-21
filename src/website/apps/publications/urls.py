from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PublicationViewSet

# Creating router for publication
router = DefaultRouter()
router.register(r'publications', PublicationViewSet, basename='publication')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
]
