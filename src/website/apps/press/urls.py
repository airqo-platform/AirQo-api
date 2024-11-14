from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PressViewSet

# Initialize the DefaultRouter
router = DefaultRouter()

# Register the PressViewSet with the router
router.register(r'press', PressViewSet, basename='press')

urlpatterns = [
    path('', include(router.urls)),
]
