from rest_framework import serializers
from .models import ImpactNumber

class ImpactNumberSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImpactNumber
        fields = [
            'african_cities', 
            'champions', 
            'deployed_monitors', 
            'data_records', 
            'research_papers', 
            'partners'
        ]
