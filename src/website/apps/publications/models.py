from cloudinary.models import CloudinaryField
from django.db import models
from utils.models import BaseModel
import cloudinary


class Publication(BaseModel):
    class CategoryTypes(models.TextChoices):
        RESEARCH = "research", "Research"
        TECHNICAL = "technical", "Technical"
        POLICY = "policy", "Policy"
        GUIDE = "guide", "Guide"
        MANUAL = "manual", "Manual"

    title = models.CharField(max_length=255)
    authors = models.TextField(null=True, blank=True)
    link = models.URLField(null=True, blank=True)
    resource_file = CloudinaryField(
        folder="website/uploads/publications/files",
        resource_type="raw",
        null=True,
        blank=True,
    )
    link_title = models.CharField(
        max_length=100, default="Read More", null=True, blank=True
    )
    category = models.CharField(
        max_length=40,
        default=CategoryTypes.RESEARCH,
        choices=CategoryTypes.choices,
        null=True,
        blank=True,
    )
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ["order", "-id"]

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        """
        Override the delete method to remove the associated Cloudinary file before deletion.
        """
        if self.resource_file:
            cloudinary.uploader.destroy(
                self.resource_file.public_id, invalidate=True)
        super().delete(*args, **kwargs)
