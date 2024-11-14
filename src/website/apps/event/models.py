# backend/apps/event/models.py
from django.db import models
from utils.models import BaseModel
from django.contrib.auth import get_user_model
from django.conf import settings
from utils.fields import ConditionalImageField, ConditionalFileField
from cloudinary.uploader import destroy
from django_quill.fields import QuillField
import os

User = get_user_model()


# Event Model
class Event(BaseModel):
    title = models.CharField(max_length=100)
    title_subtext = models.CharField(max_length=90)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    registration_link = models.URLField(null=True, blank=True)

    class WebsiteCategory(models.TextChoices):
        AirQo = "airqo", "AirQo"
        CleanAir = "cleanair", "CleanAir"

    website_category = models.CharField(
        max_length=40,
        default=WebsiteCategory.AirQo,
        choices=WebsiteCategory.choices,
        null=True,
        blank=True,
    )

    class EventTag(models.TextChoices):
        Untagged = "none", "None"
        Featured = "featured", "Featured"

    event_tag = models.CharField(
        max_length=40,
        default=EventTag.Untagged,
        choices=EventTag.choices,
        null=True,
        blank=True,
    )

    class EventCategory(models.TextChoices):
        NoneCategory = "none", "None"
        Webinar = "webinar", "Webinar"
        Workshop = "workshop", "Workshop"
        Marathon = "marathon", "Marathon"
        Conference = "conference", "Conference"
        Summit = "summit", "Summit"
        Commemoration = "commemoration", "Commemoration"
        InPerson = "in-person", "In-person"
        Hybrid = "hybrid", "Hybrid"

    event_category = models.CharField(
        max_length=40,
        default=EventCategory.NoneCategory,
        choices=EventCategory.choices,
        null=True,
        blank=True,
    )

    event_image = ConditionalImageField(
        local_upload_to='events/images/',
        cloudinary_folder='website/uploads/events/images',
        null=True,
        blank=True
    )
    background_image = ConditionalImageField(
        local_upload_to='events/images/',
        cloudinary_folder='website/uploads/events/images',
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
        return f"{self.title}"

    def delete(self, *args, **kwargs):
        # Delete files from storage for both Cloudinary and local storage
        if self.event_image:
            if not settings.DEBUG:  # Delete from Cloudinary in production
                destroy(self.event_image.public_id)
            else:  # Delete from local storage in development
                if os.path.isfile(self.event_image.path):
                    os.remove(self.event_image.path)

        if self.background_image:
            if not settings.DEBUG:
                destroy(self.background_image.public_id)
            else:
                if os.path.isfile(self.background_image.path):
                    os.remove(self.background_image.path)

        super().delete(*args, **kwargs)


# Inquiry Model
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


# Program Model
class Program(BaseModel):
    date = models.DateField()
    program_details = QuillField(default="No details available yet.")
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


# Session Model
class Session(BaseModel):
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=80, null=True, blank=True)
    session_title = models.CharField(max_length=150)
    session_details = QuillField(default="No details available yet.")
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


# PartnerLogo Model
class PartnerLogo(BaseModel):
    partner_logo = ConditionalImageField(
        local_upload_to='events/logos/',
        cloudinary_folder='website/uploads/events/logos',
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

    def delete(self, *args, **kwargs):
        if self.partner_logo:
            if not settings.DEBUG:
                destroy(self.partner_logo.public_id)
            else:
                if os.path.isfile(self.partner_logo.path):
                    os.remove(self.partner_logo.path)
        super().delete(*args, **kwargs)


# Resource Model
class Resource(BaseModel):
    title = models.CharField(max_length=100)
    link = models.URLField(null=True, blank=True)
    resource = ConditionalFileField(
        local_upload_to='publications/files/',
        cloudinary_folder='website/uploads/events/files',
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

    def delete(self, *args, **kwargs):
        if self.resource:
            if not settings.DEBUG:
                destroy(self.resource.public_id)
            else:
                if os.path.isfile(self.resource.path):
                    os.remove(self.resource.path)
        super().delete(*args, **kwargs)
