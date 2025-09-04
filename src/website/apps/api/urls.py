"""
Main API URLs configuration
"""
from django.urls import path, include

urlpatterns = [
    # V2 API endpoints
    path('v2/', include('apps.api.v2.urls')),

    # Future V1 API endpoints can be added here
    # path('v1/', include('apps.api.v1.urls')),
]
