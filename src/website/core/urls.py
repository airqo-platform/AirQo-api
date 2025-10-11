from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.templatetags.static import static as static_url
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.generic.base import RedirectView

# Swagger/OpenAPI Imports
from rest_framework import permissions
from rest_framework.permissions import IsAuthenticated
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from drf_spectacular.renderers import OpenApiJsonRenderer, OpenApiYamlRenderer

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
    # Use the main API urlpatterns so the generated schema includes v1 and v2
    patterns=[
        path('website/api/', include('apps.api.urls')),
    ],
)

# V2-focused schema view (requires authentication for UI)
protected_schema_view = get_schema_view(
    api_info,
    public=False,
    # Require authentication for the protected UI views
    permission_classes=(IsAuthenticated,),
    patterns=[
        path('website/api/', include('apps.api.urls')),
    ],
)

urlpatterns = [
    # Root URL
    path('website/', core_views.index, name='index'),

    # Admin panel
    path('website/admin/', admin.site.urls),

    # Favicon - redirect /favicon.ico to a project-provided static asset (301)
    # Use the Django static helper to build the correct asset path and
    # make the redirect permanent so browsers cache it.
    path(
        'favicon.ico',
        # path which is present at `/website/static/admin/images/favicon.ico`.
        RedirectView.as_view(url=static_url(
            'admin/images/favicon.ico'), permanent=True),
        name='favicon'
    ),

    # API routes from custom apps with specific prefixes
    path('website/', include('apps.press.urls')),
    path('website/', include('apps.impact.urls')),
    path('website/', include('apps.event.urls')),
    path('website/', include('apps.highlights.urls')),
    path('website/', include('apps.career.urls')),
    path('website/', include('apps.publications.urls')),
    path('website/', include('apps.team.urls')),
    path('website/', include('apps.board.urls')),
    # Fixed: added faq/ prefix
    path('website/faq/', include('apps.faqs.urls')),
    path('website/', include('apps.externalteams.urls')),
    path('website/', include('apps.partners.urls')),
    path('website/', include('apps.cleanair.urls')),
    path('website/', include('apps.africancities.urls')),

    # API endpoints (v1 & v2)
    path('website/api/', include('apps.api.urls')),

    # OpenAPI 3.0 Schema and Documentation (drf-spectacular) - V2 Only
    # NOTE: The raw schema (JSON) must be publicly accessible so the UI
    # (Swagger / ReDoc) can fetch a machine-readable JSON object. If this
    # endpoint is wrapped with `login_required` it will redirect to the
    # Django login page and return HTML (string), causing the docs UIs to
    # fail with errors like "Document must be JSON object, got string".
    # Keep the interactive UI views protected, but serve the raw schema
    # without authentication so tooling can load it correctly.
    # Serve raw schema and UI docs only to authenticated users (redirect to
    # the admin login page if unauthenticated). We protect both the raw
    # schema and the UI so access behaves like the admin portal.
    # Serve JSON/YAML schema but use DRF permissions so API clients receive
    # a proper 401/403 response (JSON) when unauthenticated instead of an
    # HTML redirect. The interactive UI views remain protected by
    # `login_required` so browser users are redirected to the admin login.
    path('website/api/schema/', SpectacularAPIView.as_view(
        renderer_classes=[OpenApiJsonRenderer],
        permission_classes=[IsAuthenticated]
    ), name='schema'),
    path('website/api/schema.yaml', SpectacularAPIView.as_view(
        renderer_classes=[OpenApiYamlRenderer],
        permission_classes=[IsAuthenticated]
    ), name='schema-yaml'),

    # Legacy Swagger URLs (drf-yasg) - expose under /website/api/swagger/
    re_path(
        r'^website/api/swagger(?P<format>\.json|\.yaml)$',
        # JSON/YAML schema should also require login and redirect to Django login
        login_required(public_schema_view.without_ui(cache_timeout=0)),
        name='schema-json'
    ),
    path(
        'website/api/swagger/',
        # Require login to view the Swagger UI; unauthenticated users will be
        # redirected to the Django login page.
        login_required(protected_schema_view.with_ui(
            'swagger', cache_timeout=0)),
        name='schema-swagger-ui'
    ),
    path(
        'website/api/swagger/redoc/',
        login_required(protected_schema_view.with_ui(
            'redoc', cache_timeout=0)),
        name='schema-redoc'
    ),

    # Healthcheck route
    path('website/healthcheck/', healthcheck, name='healthcheck'),
]

# Spectacular UI views - protect in production
# Always protect the interactive UI views behind the admin login so that
# unauthenticated users are redirected to the login page instead of the
# UI attempting to fetch the (protected) schema and receiving HTML.
urlpatterns += [
    path('website/api/docs/', login_required(
        SpectacularSwaggerView.as_view(url_name='schema')), name='swagger-ui'),
    path('website/api/redoc/', login_required(
        SpectacularRedocView.as_view(url_name='schema')), name='redoc'),
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
