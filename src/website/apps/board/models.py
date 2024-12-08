from django.db import models
from cloudinary.models import CloudinaryField
from utils.models import BaseModel


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
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def get_picture_url(self):
        if self.picture:
            return self.picture.url  # Cloudinary provides the actual URL of the uploaded image
        return None


class BoardMemberBiography(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)
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
