from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

# Import for Swagger
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Health check endpoint function


def healthcheck(request):
    return JsonResponse({"status": "ok"})


# Define the api_info object here
api_info = openapi.Info(
    title="AirQo API",
    default_version='v1',
    description="API documentation for AirQo Project",
    terms_of_service="https://www.airqo.net/legal/terms-of-service/",
    contact=openapi.Contact(email="support@airqo.net"),
    license=openapi.License(name="BSD License"),
)

# Define the schema view for Swagger
schema_view = get_schema_view(
    api_info,
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # API routes from custom apps in the 'apps' folder
    path('api/', include('apps.press.urls')),
    path('api/', include('apps.impact.urls')),
    path('api/', include('apps.event.urls')),
    path('api/', include('apps.highlights.urls')),
    path('api/', include('apps.career.urls')),
    path('api/', include('apps.publications.urls')),
    path('api/', include('apps.team.urls')),
    path('api/', include('apps.board.urls')),
    path('api/', include('apps.externalTeam.urls')),
    path('api/', include('apps.partners.urls')),
    path('api/', include('apps.cleanair.urls')),
    path('api/', include('apps.FAQ.urls')),
    path('api/', include('apps.africancities.urls')),

    # Swagger URLs
    re_path(r'^swagger(?P<format>\.json|\.yaml)$',
            schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger',
         cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc',
         cache_timeout=0), name='schema-redoc'),

    # Healthcheck route for Docker container readiness
    path('healthcheck/', healthcheck, name='healthcheck'),
]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
