from django.db import models
from cloudinary.models import CloudinaryField
from utils.models import BaseModel


class Tag(BaseModel):
    name = models.CharField(max_length=20, null=False, blank=False)

    def __str__(self):
        return self.name


class Highlight(BaseModel):
    title = models.CharField(max_length=110)
    # String-based reference to Tag
    tags = models.ManyToManyField("Tag", related_name='highlights')

    image = CloudinaryField(
        folder='website/uploads/highlights/images',
        null=True,
        blank=True,
        resource_type='image'
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
        Automatically delete the image from Cloudinary when the highlight is deleted.
        """
        if self.image:
            self.image.delete(save=False)
        super().delete(*args, **kwargs)
