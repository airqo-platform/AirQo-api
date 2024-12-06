from django.db import models
from django.contrib.auth import get_user_model
from django_quill.fields import QuillField
from utils.models import BaseModel
from utils.validators import validate_image, validate_file

User = get_user_model()


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

    # Image fields: In DEBUG mode (local dev) these will be stored locally.
    # In production mode (DEBUG=False), they will be uploaded to Cloudinary.
    event_image = models.ImageField(
        upload_to='website/uploads/events/images',
        validators=[validate_image],
        null=True,
        blank=True
    )
    background_image = models.ImageField(
        upload_to='website/uploads/events/images',
        validators=[validate_image],
        null=True,
        blank=True
    )

    location_name = models.CharField(max_length=100, null=True, blank=True)
    location_link = models.URLField(null=True, blank=True)
    event_details = QuillField(default="No details available yet.")
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ["order", "-start_date"]

    def __str__(self):
        return self.title


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


class Program(BaseModel):
    date = models.DateField()
    # Stored as plain text. If you prefer rich text, ensure data is consistent.
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


class PartnerLogo(BaseModel):
    partner_logo = models.ImageField(
        upload_to='website/uploads/events/logos/',
        validators=[validate_image],
        null=True,
        blank=True
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


class Resource(BaseModel):
    title = models.CharField(max_length=100)
    link = models.URLField(null=True, blank=True)
    resource = models.FileField(
        upload_to='website/uploads/events/files/',
        validators=[validate_file],
        null=True,
        blank=True
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
