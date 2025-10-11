from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.api'
    verbose_name = 'API v2'

    def ready(self):
        """Import signals when the app is ready"""
        try:
            from .v2 import signals  # noqa: F401
        except ImportError:
            pass
