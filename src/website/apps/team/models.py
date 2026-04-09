from django.db import models
from cloudinary.models import CloudinaryField
from utils.models import BaseModel, SlugBaseModel
from utils.cloudinary import safe_destroy


class Member(SlugBaseModel):
    # Slug configuration
    SLUG_SOURCE_FIELD = 'name'
    SLUG_USE_DATE = False  # Team members don't need date in slug
    SLUG_USE_LOCATION = False
    SLUG_MAX_LENGTH = 50

    name = models.CharField(max_length=100)
    title = models.CharField(max_length=100)
    about = models.TextField(blank=True)
    class MemberCategory(models.TextChoices):
        STAFF = "staff", "Staff"
        FELLOW = "fellow", "Fellow"
        EX_FELLOW = "ex-fellow", "Ex-fellow"

    category = models.CharField(
        max_length=20,
        choices=MemberCategory.choices,
        default=MemberCategory.STAFF,
        db_index=True,
    )

    picture = CloudinaryField(
        folder="website/uploads/team/members",
        resource_type="image",
        null=True,
        blank=True,
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )

    twitter = models.URLField(max_length=255, null=True, blank=True)
    linked_in = models.URLField(max_length=255, null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)

    class Meta(SlugBaseModel.Meta):
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_picture_url(self):
        if self.picture:
            return self.picture.url  # CloudinaryField already handles secure URLs
        return None

    def delete(self, *args, **kwargs):
        """
        Remove associated Cloudinary image before DB deletion; fail-open on errors.
        """
        safe_destroy(self.picture, invalidate=True)
        return super().delete(*args, **kwargs)


class MemberBiography(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)
    member = models.ForeignKey(
        'Member',
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order', 'id']

    def __str__(self):
        return f"Description {self.pk if self.pk else 'New'}"
