from django.db import models
from cloudinary.models import CloudinaryField
from cloudinary.uploader import destroy
from utils.models import BaseModel


class AfricanCountry(BaseModel):
    country_name = models.CharField(max_length=100)
    country_flag = CloudinaryField(
        folder='website/uploads/africancities/flags',
        null=True,
        blank=True,
        resource_type='image'
    )
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order', '-id']

    def __str__(self):
        return self.country_name

    def get_country_flag_url(self):
        """
        Return the secure URL for the country flag.
        """
        if self.country_flag:
            return self.country_flag.url  # Cloudinary already provides a secure URL
        return None

    def delete(self, *args, **kwargs):
        """
        Override the delete method to remove associated Cloudinary images before deletion.
        """
        if self.country_flag:
            destroy(self.country_flag.public_id, invalidate=True)
        result = super().delete(*args, **kwargs)
        return result


class City(BaseModel):
    city_name = models.CharField(max_length=100)
    order = models.IntegerField(default=1)
    african_city = models.ForeignKey(
        AfricanCountry,
        null=True,
        related_name="city",
        on_delete=models.SET_NULL,
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
        on_delete=models.SET_NULL,
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
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Paragraph-{self.id}"


class Image(BaseModel):
    image = CloudinaryField(
        folder='website/uploads/africancities/images',
        null=True,
        blank=True,
        resource_type='image'
    )
    order = models.IntegerField(default=1)
    content = models.ForeignKey(
        Content,
        null=True,
        blank=True,
        related_name="image",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Image-{self.id}"

    def delete(self, *args, **kwargs):
        """
        Override the delete method to remove the associated Cloudinary image before deletion.
        """
        if self.image:
            destroy(self.image.public_id, invalidate=True)
        result = super().delete(*args, **kwargs)
        return result

    def get_image_url(self):
        """
        Return the secure URL for the image.
        """
        if self.image:
            return self.image.url  # Cloudinary already provides a secure URL
        return None
