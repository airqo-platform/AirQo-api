import logging
from django.db import models
from django.contrib.auth import get_user_model
from django_quill.fields import QuillField
from utils.models import BaseModel
from cloudinary.models import CloudinaryField
from cloudinary.uploader import destroy

User = get_user_model()
logger = logging.getLogger(__name__)


class Event(BaseModel):
    title = models.CharField(max_length=100)
    title_subtext = models.CharField(max_length=90)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    registration_link = models.URLField(null=True, blank=True)

    class WebsiteCategory(models.TextChoices):
        AIRQO = "airqo", "AirQo"
        CLEAN_AIR = "cleanair", "CleanAir"

    website_category = models.CharField(
        max_length=40,
        choices=WebsiteCategory.choices,
        default=WebsiteCategory.AIRQO,
        null=True,
        blank=True,
    )

    class EventTag(models.TextChoices):
        UNTAGGED = "none", "None"
        FEATURED = "featured", "Featured"

    event_tag = models.CharField(
        max_length=40,
        choices=EventTag.choices,
        default=EventTag.UNTAGGED,
        null=True,
        blank=True,
    )

    class EventCategory(models.TextChoices):
        NONE_CATEGORY = "none", "None"
        WEBINAR = "webinar", "Webinar"
        WORKSHOP = "workshop", "Workshop"
        MARATHON = "marathon", "Marathon"
        CONFERENCE = "conference", "Conference"
        SUMMIT = "summit", "Summit"
        COMMEMORATION = "commemoration", "Commemoration"
        IN_PERSON = "in-person", "In-person"
        HYBRID = "hybrid", "Hybrid"

    event_category = models.CharField(
        max_length=40,
        choices=EventCategory.choices,
        default=EventCategory.NONE_CATEGORY,
        null=True,
        blank=True,
    )

    event_image = CloudinaryField(
        'image',
        folder='website/uploads/events/images',
        null=True,
        blank=True,
        default=None,
        resource_type='image'
    )
    background_image = CloudinaryField(
        'image',
        folder='website/uploads/events/images',
        null=True,
        blank=True,
        default=None,
        resource_type='image'
    )

    location_name = models.CharField(max_length=100, null=True, blank=True)
    location_link = models.URLField(null=True, blank=True)
    event_details = QuillField(default="No details available yet.")
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ["order", "-start_date"]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(f"Created new Event: ID={self.pk}, Title={self.title}")
        else:
            logger.info(f"Updated Event: ID={self.pk}, Title={self.title}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Event: ID={self.pk}, Title={self.title}")
        # Attempt to delete images from Cloudinary
        if self.event_image:
            try:
                destroy(self.event_image.public_id)
                logger.info(
                    f"Deleted event_image from Cloudinary: {self.event_image.public_id}")
            except Exception as e:
                logger.error(
                    f"Error deleting event_image from Cloudinary: {e}")
        if self.background_image:
            try:
                destroy(self.background_image.public_id)
                logger.info(
                    f"Deleted background_image from Cloudinary: {self.background_image.public_id}")
            except Exception as e:
                logger.error(
                    f"Error deleting background_image from Cloudinary: {e}")

        super().delete(*args, **kwargs)
        logger.info(f"Deleted Event: ID={self.pk}, Title={self.title}")


class Inquiry(BaseModel):
    inquiry = models.CharField(max_length=80)
    role = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField()
    order = models.IntegerField(default=1)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="inquiries",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Inquiry - {self.inquiry}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new Inquiry: ID={self.pk}, Inquiry={self.inquiry}")
        else:
            logger.info(
                f"Updated Inquiry: ID={self.pk}, Inquiry={self.inquiry}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Inquiry: ID={self.pk}, Inquiry={self.inquiry}")
        super().delete(*args, **kwargs)
        logger.info(f"Deleted Inquiry: ID={self.pk}, Inquiry={self.inquiry}")


class Program(BaseModel):
    date = models.DateField()
    program_details = models.TextField(default="No details available yet.")
    order = models.IntegerField(default=1)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="programs",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Program - {self.date}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(f"Created new Program: ID={self.pk}, Date={self.date}")
        else:
            logger.info(f"Updated Program: ID={self.pk}, Date={self.date}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Program: ID={self.pk}, Date={self.date}")
        super().delete(*args, **kwargs)
        logger.info(f"Deleted Program: ID={self.pk}, Date={self.date}")


class Session(BaseModel):
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=80, null=True, blank=True)
    session_title = models.CharField(max_length=150)
    session_details = models.TextField(default="No details available yet.")
    order = models.IntegerField(default=1)
    program = models.ForeignKey(
        Program,
        null=True,
        blank=True,
        related_name="sessions",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Session - {self.session_title}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new Session: ID={self.pk}, Title={self.session_title}")
        else:
            logger.info(
                f"Updated Session: ID={self.pk}, Title={self.session_title}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Session: ID={self.pk}, Title={self.session_title}")
        super().delete(*args, **kwargs)
        logger.info(
            f"Deleted Session: ID={self.pk}, Title={self.session_title}")


class PartnerLogo(BaseModel):
    partner_logo = CloudinaryField(
        'image',
        folder='website/uploads/events/logos',
        null=True,
        blank=True,
        default=None,
        resource_type='image'
    )
    name = models.CharField(max_length=70)
    order = models.IntegerField(default=1)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="partner_logos",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Partner - {self.name}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new PartnerLogo: ID={self.pk}, Name={self.name}")
        else:
            logger.info(f"Updated PartnerLogo: ID={self.pk}, Name={self.name}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete PartnerLogo: ID={self.pk}, Name={self.name}")
        if self.partner_logo:
            try:
                destroy(self.partner_logo.public_id)
                logger.info(
                    f"Deleted partner_logo from Cloudinary: {self.partner_logo.public_id}")
            except Exception as e:
                logger.error(
                    f"Error deleting partner_logo from Cloudinary: {e}")
        super().delete(*args, **kwargs)
        logger.info(f"Deleted PartnerLogo: ID={self.pk}, Name={self.name}")


class Resource(BaseModel):
    title = models.CharField(max_length=100)
    link = models.URLField(null=True, blank=True)
    resource = CloudinaryField(
        'file',
        folder='website/uploads/events/files',
        null=True,
        blank=True,
        default=None,
        resource_type='raw'
    )
    order = models.IntegerField(default=1)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="resources",
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"Resource - {self.title}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new Resource: ID={self.pk}, Title={self.title}")
        else:
            logger.info(f"Updated Resource: ID={self.pk}, Title={self.title}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Resource: ID={self.pk}, Title={self.title}")
        if self.resource:
            try:
                destroy(self.resource.public_id)
                logger.info(
                    f"Deleted resource from Cloudinary: {self.resource.public_id}")
            except Exception as e:
                logger.error(f"Error deleting resource from Cloudinary: {e}")
        super().delete(*args, **kwargs)
        logger.info(f"Deleted Resource: ID={self.pk}, Title={self.title}")
