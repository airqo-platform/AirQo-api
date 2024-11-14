from django.conf import settings
from django.db import models
from utils.fields import ConditionalImageField
from utils.models import BaseModel


class AfricanCountry(BaseModel):
    country_name = models.CharField(max_length=100)
    country_flag = ConditionalImageField(
        local_upload_to='countries/flags/',
        cloudinary_folder='website/uploads/countries/flags',
        null=True,
        blank=True
    )

    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order', '-id']

    def __str__(self):
        return self.country_name

    def get_country_flag_url(self, request=None):
        """
        Return the full URL for the country flag.
        - For Cloudinary, return a secure HTTPS URL.
        - For local development, return the absolute URL using request.build_absolute_uri.
        """
        if self.country_flag:
            if not settings.DEBUG:
                # Cloudinary secure URL
                return self.country_flag.url  # Already provides secure URL by default
            else:
                # Local development, ensure full URL
                return request.build_absolute_uri(self.country_flag.url) if request else self.country_flag.url
        return None


class City(BaseModel):
    city_name = models.CharField(max_length=100)
    order = models.IntegerField(default=1)
    african_city = models.ForeignKey(
        AfricanCountry,
        null=True,
        related_name="city",
        on_delete=models.deletion.SET_NULL,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.city_name


class Content(BaseModel):
    title = models.CharField(max_length=150)
    order = models.IntegerField(default=1)
    city = models.ForeignKey(
        City,
        null=True,
        related_name="content",
        on_delete=models.deletion.SET_NULL,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Section-{self.id}"


class Description(BaseModel):
    paragraph = models.TextField()
    order = models.IntegerField(default=1)
    content = models.ForeignKey(
        Content,
        null=True,
        blank=True,
        related_name="description",
        on_delete=models.deletion.SET_NULL,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Paragraph-{self.id}"


class Image(BaseModel):
    image = ConditionalImageField(
        local_upload_to='content/images/',
        cloudinary_folder='website/uploads/content/images',
        null=True,
        blank=True
    )
    order = models.IntegerField(default=1)
    content = models.ForeignKey(
        'Content',
        null=True,
        blank=True,
        related_name="image",
        on_delete=models.deletion.SET_NULL,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image-{self.id}"

    def get_image_url(self, request=None):
        """
        Return the full URL for the image.
        - For Cloudinary, return a secure HTTPS URL.
        - For local development, return the absolute URL using request.build_absolute_uri.
        """
        if self.image:
            if not settings.DEBUG:
                # Cloudinary secure URL
                return self.image.url  # Cloudinary already provides secure URL
            else:
                # Local development, ensure full URL
                return request.build_absolute_uri(self.image.url) if request else self.image.url
        return None
