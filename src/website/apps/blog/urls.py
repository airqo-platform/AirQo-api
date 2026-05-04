from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BlogPostViewSet

router = DefaultRouter()
router.register(r'blogs', BlogPostViewSet, basename='blogpost')

urlpatterns = [
    path('', include(router.urls)),
]