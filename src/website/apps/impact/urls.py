from rest_framework.routers import DefaultRouter
from .views import ImpactNumberViewSet

router = DefaultRouter()
router.register(r'impact-number', ImpactNumberViewSet, basename='impact-number')

urlpatterns = router.urls
