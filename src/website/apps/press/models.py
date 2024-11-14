import cloudinary
from django.conf import settings
from django.db import models
from utils.models import BaseModel
from utils.fields import ConditionalImageField


class Press(BaseModel):
    article_title = models.CharField(max_length=100)
    article_intro = models.CharField(max_length=200, null=True, blank=True)
    article_link = models.URLField(null=True, blank=True)
    date_published = models.DateField()

    publisher_logo = ConditionalImageField(
        local_upload_to='press/logos/',
        cloudinary_folder='website/uploads/press/logos',
        null=True,
        blank=True
    )

    order = models.IntegerField(default=1)

    class WebsiteCategory(models.TextChoices):
        AIRQO = "airqo", "AirQo"
        CLEAN_AIR = "cleanair", "CleanAir"

    website_category = models.CharField(
        max_length=40,
        default=WebsiteCategory.AIRQO,
        choices=WebsiteCategory.choices,
        null=True,
        blank=True
    )

    class ArticleTag(models.TextChoices):
        UNTAGGED = "none", "None"
        FEATURED = "featured", "Featured"

    article_tag = models.CharField(
        max_length=40,
        default=ArticleTag.UNTAGGED,
        choices=ArticleTag.choices,
        null=True,
        blank=True
    )

    class Meta:
        ordering = ['order', '-id']
        verbose_name = 'Press Article'
        verbose_name_plural = 'Press Articles'

    def __str__(self):
        return self.article_title

    def delete(self, *args, **kwargs):
        """
        Override the delete method to remove the associated Cloudinary file or local file
        before deleting the Press article instance.
        """
        if self.publisher_logo:
            public_id = self.publisher_logo.public_id
            if public_id:
                cloudinary.uploader.destroy(public_id)

        super().delete(*args, **kwargs)
