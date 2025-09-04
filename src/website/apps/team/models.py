from django.db import models
from cloudinary.models import CloudinaryField
from utils.models import BaseModel


class Member(BaseModel):
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=100)
    about = models.TextField(blank=True)

    picture = CloudinaryField(
        folder="website/uploads/team/members",
        resource_type="image",
        null=True,
        blank=True
    )

    twitter = models.URLField(max_length=255, null=True, blank=True)
    linked_in = models.URLField(max_length=255, null=True, blank=True)
    order = models.IntegerField(default=1)

    class Meta(BaseModel.Meta):
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_picture_url(self):
        if self.picture:
            return self.picture.url  # CloudinaryField already handles secure URLs
        return None


class MemberBiography(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)
    member = models.ForeignKey(
        Member,
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order', 'id']

    def __str__(self):
        return f"Description {self.pk if self.pk else 'New'}"
