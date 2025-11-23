from django.db import models
from utils.models import BaseModel
from utils.fields import optimized_cloudinary_field
from cloudinary.uploader import destroy


class Tag(BaseModel):
    name = models.CharField(max_length=20, null=False, blank=False)

    def __str__(self):
        return self.name


class Highlight(BaseModel):
    title = models.CharField(max_length=110)
    # String-based reference to Tag
    tags = models.ManyToManyField("Tag", related_name='highlights')

    image = optimized_cloudinary_field(
        'website/uploads/highlights/images',
        resource_type='image',
        default='website/uploads/default_image.webp'
    )

    link = models.URLField()
    link_title = models.CharField(max_length=20, blank=True)
    order = models.IntegerField(default=1, db_index=True)

    class Meta(BaseModel.Meta):
        """Model metadata inheriting from BaseModel.Meta to remain compatible
        with the base class's abstract Meta type (avoids Pylance type errors).
        """
        ordering = ['order', '-id']

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        """
        Automatically delete the image from Cloudinary when the highlight is deleted.
        """
        if self.image:
            destroy(self.image.public_id, invalidate=True)
        return super().delete(*args, **kwargs)
