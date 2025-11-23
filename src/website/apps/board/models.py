from django.db import models
from cloudinary.models import CloudinaryField
from cloudinary.uploader import destroy
from utils.models import BaseModel
import logging

logger = logging.getLogger(__name__)


class BoardMember(BaseModel):
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=100)

    picture = CloudinaryField(
        folder='website/uploads/team/board_members',
        null=True,
        blank=True,
        resource_type='image',
    )

    twitter = models.URLField(max_length=255, null=True, blank=True)
    linked_in = models.URLField(max_length=255, null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_picture_url(self):
        if self.picture:
            return self.picture.url  # Cloudinary provides the actual URL of the uploaded image
        return None

    def delete(self, *args, **kwargs):
        """
        Remove associated Cloudinary image before DB deletion; fail-open on errors.
        """
        pic_id = getattr(self.picture, "public_id", None)
        if pic_id:
            try:
                destroy(pic_id, invalidate=True)
            except Exception:
                logger.warning(
                    "Cloudinary destroy failed for BoardMember %s (public_id=%s)", self.pk, pic_id)
        return super().delete(*args, **kwargs)


class BoardMemberBiography(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)
    member = models.ForeignKey(
        BoardMember,
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Description {self.id}"
