from cloudinary.models import CloudinaryField
from cloudinary.uploader import destroy
from django.db import models
from utils.models import BaseModel, SlugBaseModel


class Publication(SlugBaseModel):
    class CategoryTypes(models.TextChoices):
        RESEARCH = "research", "Research"
        TECHNICAL = "technical", "Technical"
        POLICY = "policy", "Policy"
        GUIDE = "guide", "Guide"
        MANUAL = "manual", "Manual"

    # Slug configuration
    SLUG_SOURCE_FIELD = 'title'
    SLUG_USE_DATE = True
    SLUG_USE_LOCATION = False
    SLUG_MAX_LENGTH = 100

    title = models.CharField(max_length=255)
    authors = models.TextField(null=True, blank=True)
    description = models.TextField(
        null=True, blank=True, help_text="Optional description of the publication"
    )
    link = models.URLField(null=True, blank=True)
    resource_file = CloudinaryField(
        folder="website/uploads/publications/files",
        resource_type="raw",
        null=True,
        blank=True,
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
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

    class Meta(SlugBaseModel.Meta):
        ordering = ["order", "-id"]

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        """
        Override the delete method to remove the associated Cloudinary file before deletion.
        """
        if self.resource_file:
            destroy(self.resource_file.public_id, invalidate=True)
        result = super().delete(*args, **kwargs)
        return result
