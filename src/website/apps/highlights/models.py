from django.db import models
from django.conf import settings
from utils.models import BaseModel
from utils.fields import ConditionalImageField

# Tag Model


class Tag(BaseModel):
    name = models.CharField(max_length=20, null=False, blank=False)

    def __str__(self):
        return self.name


# Highlight Model
class Highlight(BaseModel):
    title = models.CharField(max_length=110)
    tags = models.ManyToManyField(Tag, related_name='highlights')

    # Use ConditionalImageField for handling local or Cloudinary image storage
    image = ConditionalImageField(
        local_upload_to='highlights/images/',
        cloudinary_folder='website/uploads/highlights/images',
        default='website/uploads/default_image.webp',
        null=True,
        blank=True
    )

    link = models.URLField()
    link_title = models.CharField(max_length=20, blank=True)
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order', '-id']

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        """
        Automatically delete the file from Cloudinary or local storage
        when the highlight is deleted.
        """
        if self.image:
            self.image.delete(save=False)
        super().delete(*args, **kwargs)
