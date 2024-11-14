from django.db import models
from utils.models import BaseModel


class ImpactNumber(BaseModel):
    african_cities = models.IntegerField(default=8)
    champions = models.IntegerField(default=1500)
    deployed_monitors = models.IntegerField(default=200)
    data_records = models.IntegerField(default=67)
    research_papers = models.IntegerField(default=10)
    partners = models.IntegerField(default=300)

    def save(self, *args, **kwargs):
        """
        Ensure only one instance of ImpactNumber exists.
        """
        if not self.pk and ImpactNumber.objects.exists():
            instance = ImpactNumber.objects.first()
            instance.african_cities = self.african_cities
            instance.champions = self.champions
            instance.deployed_monitors = self.deployed_monitors
            instance.data_records = self.data_records
            instance.research_papers = self.research_papers
            instance.partners = self.partners
            instance.save()
            return instance
        return super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Impact Number"
        verbose_name_plural = "Impact Numbers"
