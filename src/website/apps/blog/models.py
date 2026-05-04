import logging

from cloudinary.models import CloudinaryField
from django.db import models
from django.utils import timezone
from django_quill.fields import QuillField

from utils.cloudinary import safe_destroy
from utils.models import SlugBaseModel

logger = logging.getLogger(__name__)


class BlogPost(SlugBaseModel):
    class WebsiteCategory(models.TextChoices):
        AIRQO = "airqo", "AirQo"
        CLEAN_AIR = "cleanair", "CleanAir"

    title = models.CharField(max_length=160)
    summary = models.CharField(max_length=280, blank=True, default="")
    content = QuillField(blank=True, default="")
    author_image = CloudinaryField(
        'image',
        folder='website/uploads/blog/authors',
        null=True,
        blank=True,
        default=None,
        resource_type='image',
        chunk_size=5 * 1024 * 1024,
        timeout=600,
    )
    author_role = models.CharField(max_length=120, blank=True, default="")
    meta_title = models.CharField(max_length=160, blank=True, default="")
    meta_description = models.TextField(blank=True, default="")
    cover_image = CloudinaryField(
        'image',
        folder='website/uploads/blog/images',
        null=True,
        blank=True,
        default=None,
        resource_type='image',
        chunk_size=5 * 1024 * 1024,
        timeout=600,
    )
    author_name = models.CharField(max_length=120, blank=True, default="")
    published_at = models.DateTimeField(default=timezone.now, db_index=True)
    is_published = models.BooleanField(default=True, db_index=True)
    website_category = models.CharField(
        max_length=40,
        choices=WebsiteCategory.choices,
        default=WebsiteCategory.AIRQO,
        null=True,
        blank=True,
        db_index=True,
    )
    order = models.IntegerField(default=1, db_index=True)

    SLUG_SOURCE_FIELD = 'title'
    SLUG_USE_DATE = False
    SLUG_USE_LOCATION = False
    SLUG_MAX_LENGTH = 120

    class Meta(SlugBaseModel.Meta):
        ordering = ['order', '-published_at', '-id']
        verbose_name = 'Blog Post'
        verbose_name_plural = 'Blog Posts'
        indexes = [
            models.Index(fields=['website_category', 'is_published', 'order']),
            models.Index(fields=['website_category', 'is_published', 'published_at']),
            models.Index(fields=['is_published', 'published_at']),
        ]

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return f"/website/blogs/{self.get_public_identifier()}/"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info("Created new BlogPost: ID=%s, Title=%s", self.pk, self.title)
        else:
            logger.info("Updated BlogPost: ID=%s, Title=%s", self.pk, self.title)

    def delete(self, *args, **kwargs):
        logger.debug("Attempting to delete BlogPost: ID=%s, Title=%s", self.pk, self.title)
        safe_destroy(self.cover_image, invalidate=True)
        result = super().delete(*args, **kwargs)
        logger.info("Deleted BlogPost: ID=%s, Title=%s", self.pk, self.title)
        return result