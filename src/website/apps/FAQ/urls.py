from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'faqs', views.FAQViewSet, basename='faq')

urlpatterns = router.urls
