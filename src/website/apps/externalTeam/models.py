from django.db import models
from utils.fields import ConditionalImageField
from utils.models import BaseModel


class ExternalTeamMember(BaseModel):
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=100)

    picture = ConditionalImageField(
        local_upload_to='external_team/',
        cloudinary_folder='website/uploads/team/externalTeam',
        null=True,
        blank=True
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
            return self.picture.url  # This handles both local and Cloudinary URLs
        return None


class ExternalTeamMemberBiography(BaseModel):
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1)
    member = models.ForeignKey(
        ExternalTeamMember,
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"Description {self.id}"
