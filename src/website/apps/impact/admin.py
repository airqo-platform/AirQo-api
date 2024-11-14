from django.contrib import admin
from .models import ImpactNumber

@admin.register(ImpactNumber)
class ImpactNumberAdmin(admin.ModelAdmin):
    list_display = ('african_cities', 'champions', 'deployed_monitors',
                    'data_records', 'research_papers', 'partners',)

    def has_add_permission(self, request):
        # Only allow adding a new ImpactNumber if it doesn't exist
        return not ImpactNumber.objects.exists()
