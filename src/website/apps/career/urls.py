from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CareerViewSet, DepartmentViewSet

router = DefaultRouter()
router.register(r'careers', CareerViewSet, basename='career')
router.register(r'departments', DepartmentViewSet, basename='department')

urlpatterns = [
    path('', include(router.urls)),
]
