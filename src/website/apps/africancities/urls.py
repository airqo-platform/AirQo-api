from django.urls import path, include
from rest_framework import routers
from .views import AfricanCityViewSet

router = routers.DefaultRouter()
router.register(r'african-countries', AfricanCityViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
