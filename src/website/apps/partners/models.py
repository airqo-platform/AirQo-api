from django.db import models
from cloudinary.models import CloudinaryField
from cloudinary.uploader import destroy
from utils.models import BaseModel, SlugBaseModel
import logging

logger = logging.getLogger(__name__)


class Partner(SlugBaseModel):
    # Slug configuration
    SLUG_SOURCE_FIELD = 'partner_name'
    SLUG_USE_DATE = False  # Partners typically don't need year
    SLUG_USE_LOCATION = False
    SLUG_MAX_LENGTH = 70

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
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )
    partner_logo = CloudinaryField(
        folder="website/uploads/partners/logos",
        resource_type="image",
        null=True,
        blank=True,
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )
    partner_name = models.CharField(max_length=200)
    order = models.IntegerField(default=1, db_index=True)
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
    featured = models.BooleanField(default=False)

    class Meta(SlugBaseModel.Meta):
        ordering = ["order", "id"]

    def __str__(self):
        return f"Partner - {self.partner_name}"

    def delete(self, *args, **kwargs):
        """
        Remove associated Cloudinary images before DB deletion; fail-open on errors.
        """
        for field in [self.partner_image, self.partner_logo]:
            field_id = getattr(field, "public_id", None)
            if field_id:
                try:
                    destroy(field_id, invalidate=True)
                except Exception:
                    logger.warning(
                        "Cloudinary destroy failed for Partner %s (public_id=%s)", self.pk, field_id)
        return super().delete(*args, **kwargs)


class PartnerDescription(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)
    partner = models.ForeignKey(
        Partner,
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ["order", "id"]

    def __str__(self):
        instance_id = getattr(self, 'id', None)
        return f"Description {instance_id}" if instance_id else "Description"
