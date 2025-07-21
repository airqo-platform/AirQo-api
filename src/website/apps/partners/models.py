from django.db import models
from cloudinary.models import CloudinaryField
from utils.models import BaseModel


class Partner(BaseModel):
    class RelationTypes(models.TextChoices):
        PARTNERSHIP = "partnership", "Partnership"
        COLLABORATION = "collaboration", "Collaboration"
        POLICY = "policy", "Policy"
        FUNDER = "funder", "Funder"
        RESEARCH = "research", "Research"
        NETWORK = "ca-network", "Clean air Network Partner"
        SUPPORT = "ca-support", "Clean air Supporting Partner"
        FORUM = "ca-forum", "Clean air Policy Forum"
        PRIVATE = "ca-private-sector", "Clean air Private Sector"

    partner_image = CloudinaryField(
        folder="website/uploads/partners/images",
        resource_type="image",
        null=True,
        blank=True,
    )
    partner_logo = CloudinaryField(
        folder="website/uploads/partners/logos",
        resource_type="image",
        null=True,
        blank=True,
    )
    partner_name = models.CharField(max_length=200)
    order = models.IntegerField(default=1)
    partner_link = models.URLField(null=True, blank=True)
    type = models.CharField(
        max_length=40,
        choices=RelationTypes.choices,
        default=RelationTypes.PARTNERSHIP,
        null=True,
        blank=True,
    )

    class WebsiteCategory(models.TextChoices):
        AIRQO = "airqo", "AirQo"
        CLEANAIR = "cleanair", "CleanAir"

    website_category = models.CharField(
        max_length=40,
        choices=WebsiteCategory.choices,
        default=WebsiteCategory.AIRQO,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Partner - {self.partner_name}"


class PartnerDescription(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)
    partner = models.ForeignKey(
        Partner,
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Description {self.id}"
