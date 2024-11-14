# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CleanAirResourceViewSet, ForumEventViewSet

router = DefaultRouter()
router.register(r'clean-air-resources', CleanAirResourceViewSet,
                basename='clean-air-resource')
router.register(r'forum-events', ForumEventViewSet, basename='forum-event')

urlpatterns = [
    path('', include(router.urls)),
]
