from django.db import models
from utils.models import BaseModel
from utils.fields import ConditionalFileField
from django.db.models.signals import post_delete
from django.dispatch import receiver


class Publication(BaseModel):
    class CategoryTypes(models.TextChoices):
        Research = "research", "Research"
        Technical = "technical", "Technical"
        Policy = "policy", "Policy"
        Guide = "guide", "Guide"
        Manual = "manual", "Manual"

    title = models.CharField(max_length=255)
    authors = models.TextField(null=True, blank=True)
    link = models.URLField(null=True, blank=True)

    # Using ConditionalFileField to manage both local and Cloudinary file storage
    resource_file = ConditionalFileField(
        local_upload_to='publications/files/',
        cloudinary_folder='website/uploads/publications/files',
        null=True,
        blank=True
    )

    link_title = models.CharField(
        max_length=100, default="Read More", null=True, blank=True)
    category = models.CharField(
        max_length=40,
        default=CategoryTypes.Research,
        choices=CategoryTypes.choices,
        null=True,
        blank=True
    )
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order', '-id']

    def __str__(self):
        return self.title


# Signal to delete the file when a Publication instance is deleted
@receiver(post_delete, sender=Publication)
def delete_resource_file(sender, instance, **kwargs):
    """
    Signal that ensures the file is deleted both locally and from Cloudinary
    when a Publication instance is deleted.
    """
    if instance.resource_file:
        instance.resource_file.delete(save=False)
