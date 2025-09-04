from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

# Swagger/OpenAPI Imports
from rest_framework import permissions
from rest_framework.permissions import IsAuthenticated
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

# Import for custom error handlers
from core import views as core_views

# Health check endpoint


def healthcheck(request):
    return JsonResponse({"status": "ok"})


# Swagger schema view for v2 API only
api_info = openapi.Info(
    title="AirQo Website API v2",
    default_version='v2',
    description="Enhanced API documentation for AirQo Website - providing access to air quality data, events, team information, publications, and more. This documentation covers v2 endpoints only with improved performance and features.",
    terms_of_service="https://www.airqo.net/legal/terms-of-service/",
    contact=openapi.Contact(email="support@airqo.net"),
    license=openapi.License(name="BSD License"),
)

# V2-focused schema view (public access for JSON/YAML)
public_schema_view = get_schema_view(
    api_info,
    public=True,
    permission_classes=(permissions.AllowAny,),
    patterns=[
        path('website/api/v2/', include('apps.api.v2.urls')),
    ],
)

# V2-focused schema view (requires authentication for UI)
protected_schema_view = get_schema_view(
    api_info,
    public=False,
    # Require authentication for the protected UI views
    permission_classes=(IsAuthenticated,),
    patterns=[
        path('website/api/v2/', include('apps.api.v2.urls')),
    ],
)

urlpatterns = [
    # Root URL
    path('website/', core_views.index, name='index'),

    # Admin panel
    path('website/admin/', admin.site.urls),

    # API routes from custom apps with specific prefixes
    path('website/', include('apps.press.urls')),
    path('website/', include('apps.impact.urls')),
    path('website/', include('apps.event.urls')),
    path('website/', include('apps.highlights.urls')),
    path('website/', include('apps.career.urls')),
    path('website/', include('apps.publications.urls')),
    path('website/', include('apps.team.urls')),
    path('website/', include('apps.board.urls')),
    path('website/', include('apps.faqs.urls')),
    path('website/', include('apps.externalteams.urls')),
    path('website/', include('apps.partners.urls')),
    path('website/', include('apps.cleanair.urls')),
    path('website/', include('apps.africancities.urls')),

    # API endpoints (v1 & v2)
    path('website/api/', include('apps.api.urls')),

    # OpenAPI 3.0 Schema and Documentation (drf-spectacular) - V2 Only
    path('website/api/schema/', SpectacularAPIView.as_view(), name='schema'),

    # Legacy Swagger URLs (drf-yasg) - V2 Only
    re_path(
        r'^swagger(?P<format>\.json|\.yaml)$',
        public_schema_view.without_ui(cache_timeout=0),
        name='schema-json'
    ),
    path(
        'website/swagger/',
        protected_schema_view.with_ui('swagger', cache_timeout=0),
        name='schema-swagger-ui'
    ),
    path(
        'website/redoc/',
        protected_schema_view.with_ui('redoc', cache_timeout=0),
        name='schema-redoc'
    ),

    # Healthcheck route
    path('website/healthcheck/', healthcheck, name='healthcheck'),
]

# Spectacular UI views - protect in production
if settings.DEBUG:
    urlpatterns += [
        path('website/api/docs/',
             SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        path('website/api/redoc/',
             SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]
else:
    # In production protect the UI docs behind the admin login (redirect)
    urlpatterns += [
        path('website/api/docs/', login_required(
            SpectacularSwaggerView.as_view(url_name='schema')), name='swagger-ui'),
        path('website/api/redoc/',
             login_required(SpectacularRedocView.as_view(url_name='schema')), name='redoc'),
    ]

# Serve media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)

# Error handling in production
if not settings.DEBUG:
    # Define custom error handlers
    handler404 = 'core.views.custom_404'
    handler500 = 'core.views.custom_500'
