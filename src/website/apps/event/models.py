import logging
from django.db import models
from django.contrib.auth import get_user_model
from django_quill.fields import QuillField
from utils.models import BaseModel, SlugBaseModel
from cloudinary.models import CloudinaryField
from utils.cloudinary import safe_destroy

User = get_user_model()
logger = logging.getLogger(__name__)
EMPTY_QUILL_VALUE = '{"delta":"","html":""}'


class Event(SlugBaseModel):
    title = models.CharField(max_length=100)
    title_subtext = models.CharField(max_length=90)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    registration_link = models.URLField(null=True, blank=True)

    # Slug configuration
    SLUG_SOURCE_FIELD = 'title'
    SLUG_USE_DATE = True
    SLUG_USE_LOCATION = True
    SLUG_MAX_LENGTH = 80

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
        resource_type='image',
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )
    background_image = CloudinaryField(
        'image',
        folder='website/uploads/events/images',
        null=True,
        blank=True,
        default=None,
        resource_type='image',
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )

    location_name = models.CharField(max_length=100, null=True, blank=True)
    location_link = models.URLField(null=True, blank=True)
    event_details = QuillField(default=EMPTY_QUILL_VALUE)
    order = models.IntegerField(default=1, db_index=True)

    class Meta(SlugBaseModel.Meta):
        ordering = ["order", "-start_date"]
        indexes = [
            models.Index(fields=["event_tag", "order", "start_date"]),
            models.Index(fields=["website_category", "order", "start_date"]),
        ]

    def __str__(self):
        return self.title

    def get_event_status(self):
        """Return the event status based on dates"""
        from django.utils import timezone
        now = timezone.now().date()

        # Treat events with no end_date as single-day events (end_date == start_date)
        effective_end = self.end_date or self.start_date

        # If the event starts in the future -> upcoming
        if self.start_date > now:
            return 'upcoming'

        # If the effective end is before today -> past
        if effective_end < now:
            return 'past'

        # Otherwise it's ongoing (includes single-day events happening today)
        return 'ongoing'

    def is_virtual_event(self):
        """Check if event is virtual based on location"""
        if not self.location_name:
            return False
        location_text = str(self.location_name).lower()
        virtual_keywords = ['virtual', 'online',
                            'zoom', 'webinar', 'digital', 'remote']
        return any(keyword in location_text for keyword in virtual_keywords)

    def get_duration_days(self):
        """Get event duration in days"""
        if not self.end_date:
            return 1
        return (self.end_date - self.start_date).days + 1

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
        safe_destroy(self.event_image, invalidate=True)
        safe_destroy(self.background_image, invalidate=True)

        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted Event: ID={self.pk}, Title={self.title}")
        return result

    @property
    def is_side_event(self) -> bool:
        """Return True if this event is linked as a side event of a parent."""
        # `parent_event_links` is the reverse FK from EventSideEvent.side_event.
        # Using `exists()` keeps this cheap.
        return self.parent_event_links.filter(is_deleted=False).exists()

    @property
    def has_side_events(self) -> bool:
        """Return True if this event has at least one side event link."""
        return self.side_event_links.filter(is_deleted=False).exists()


class Inquiry(BaseModel):
    inquiry = models.CharField(max_length=80)
    role = models.CharField(max_length=100, null=True, blank=True)
    email = models.EmailField()
    order = models.IntegerField(default=1, db_index=True)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="inquiries",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
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
        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted Inquiry: ID={self.pk}, Inquiry={self.inquiry}")
        return result


class Program(BaseModel):
    date = models.DateField()
    program_details = QuillField(default=EMPTY_QUILL_VALUE)
    order = models.IntegerField(default=1, db_index=True)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="programs",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
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
        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted Program: ID={self.pk}, Date={self.date}")
        return result


class Session(BaseModel):
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=80, null=True, blank=True)
    session_title = models.CharField(max_length=150)
    session_details = QuillField(default=EMPTY_QUILL_VALUE)
    order = models.IntegerField(default=1, db_index=True)
    program = models.ForeignKey(
        Program,
        null=True,
        blank=True,
        related_name="sessions",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
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
        result = super().delete(*args, **kwargs)
        logger.info(
            f"Deleted Session: ID={self.pk}, Title={self.session_title}")
        return result


class PartnerLogo(BaseModel):
    partner_logo = CloudinaryField(
        'image',
        folder='website/uploads/events/logos',
        null=True,
        blank=True,
        default=None,
        resource_type='image',
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )
    name = models.CharField(max_length=70)
    order = models.IntegerField(default=1, db_index=True)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="partner_logos",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
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
        safe_destroy(self.partner_logo, invalidate=True)
        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted PartnerLogo: ID={self.pk}, Name={self.name}")
        return result


class Resource(BaseModel):
    title = models.CharField(max_length=100)
    link = models.URLField(null=True, blank=True)
    resource = CloudinaryField(
        'file',
        folder='website/uploads/events/files',
        null=True,
        blank=True,
        default=None,
        resource_type='raw',
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )
    order = models.IntegerField(default=1, db_index=True)
    event = models.ForeignKey(
        Event,
        null=True,
        blank=True,
        related_name="resources",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
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
        safe_destroy(self.resource, invalidate=True, resource_type="raw")
        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted Resource: ID={self.pk}, Title={self.title}")
        return result


class Organizer(BaseModel):
    """
    Reusable organizer entity that can be linked to one or more events.

    Organizers are kept as a separate catalog so the same organization does
    not have to be re-created for each event. The link to events is managed
    via the :class:`EventOrganizer` through model.
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
        help_text="URL-friendly identifier for the organizer",
        db_index=True,
    )
    logo = CloudinaryField(
        'image',
        folder='website/uploads/events/organizers',
        null=True,
        blank=True,
        default=None,
        resource_type='image',
        chunk_size=5*1024*1024,
        timeout=600,
    )
    website_url = models.URLField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)

    class Meta(BaseModel.Meta):
        ordering = ['order', 'name']
        indexes = [
            models.Index(fields=['order', 'name']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        from django.utils.text import slugify as _slugify
        is_new = self.pk is None
        if not self.slug and self.name:
            base = _slugify(self.name)[:240] or 'organizer'
            candidate = base
            counter = 1
            OrganizerModel = self.__class__
            while OrganizerModel.objects.filter(
                slug=candidate
            ).exclude(pk=self.pk if self.pk else None).exists():
                candidate = f"{base}-{counter}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)
        if is_new:
            logger.info(f"Created new Organizer: ID={self.pk}, Name={self.name}")
        else:
            logger.info(f"Updated Organizer: ID={self.pk}, Name={self.name}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Organizer: ID={self.pk}, Name={self.name}")
        safe_destroy(self.logo, invalidate=True)
        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted Organizer: ID={self.pk}, Name={self.name}")
        return result


class EventOrganizer(BaseModel):
    """
    Through model linking an :class:`Event` to an :class:`Organizer`.

    A single Organizer can be linked to many Events, and a single Event can
    have many Organizers. The (event, organizer) pair is unique to prevent
    duplicate links.

    Note on data safety:
    - Deleting an Event removes the through rows for that event only;
      Organizer records themselves are preserved.
    - Deleting an Organizer removes the through rows linking it to events;
      Event records themselves are preserved.
    """
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='event_organizer_links',
    )
    organizer = models.ForeignKey(
        Organizer,
        on_delete=models.CASCADE,
        related_name='event_links',
    )
    role = models.CharField(
        max_length=40,
        choices=[
            ('organizer', 'Organizer'),
            ('co-organizer', 'Co-organizer'),
            ('host', 'Host'),
            ('partner', 'Partner'),
            ('sponsor', 'Sponsor'),
        ],
        default='organizer',
    )
    order = models.IntegerField(default=1, db_index=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Event organizer link"
        verbose_name_plural = "Event organizer links"
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'organizer'],
                name='unique_event_organizer',
            ),
        ]
        indexes = [
            models.Index(fields=['event', 'order']),
            models.Index(fields=['organizer', 'order']),
        ]

    def __str__(self):
        try:
            return f"{self.organizer} - {self.event} ({self.role})"
        except Exception:
            return f"EventOrganizer #{self.pk}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.event_id and self.organizer_id and self.event_id == self.organizer_id:
            raise ValidationError("An organizer cannot be linked to itself.")

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new EventOrganizer: ID={self.pk}, "
                f"Event={self.event_id}, Organizer={self.organizer_id}")
        else:
            logger.info(
                f"Updated EventOrganizer: ID={self.pk}, "
                f"Event={self.event_id}, Organizer={self.organizer_id}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete EventOrganizer: ID={self.pk}, "
            f"Event={self.event_id}, Organizer={self.organizer_id}")
        result = super().delete(*args, **kwargs)
        logger.info(
            f"Deleted EventOrganizer: ID={self.pk}, "
            f"Event={self.event_id}, Organizer={self.organizer_id}")
        return result


class EventSideEvent(BaseModel):
    """
    Through model linking a main/parent :class:`Event` to one or more
    sub/side events. Side events are themselves Events (they have their
    own title, date, location, slug, etc.).

    Validation rules:
    - A side event cannot be the same as its parent.
    - The (parent_event, side_event) pair must be unique.
    - Circular relationships are prevented (a side event cannot also be
      a parent of its own parent).
    - No nested chains (a side event cannot have its own side events).

    Note on data safety:
    - Deleting the link only removes the through row.
    - Deleting the parent Event cascades the through rows for that event;
      the child Event records themselves are preserved.
    - Deleting a child Event cascades the through rows for that event;
      the parent Event record itself is preserved.
    """
    parent_event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='side_event_links',
    )
    side_event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='parent_event_links',
    )
    label = models.CharField(
        max_length=100,
        default='Side event',
        help_text="Optional label describing the relationship "
                  "(e.g. 'Side event', 'Sub-event', 'Parallel session').",
    )
    order = models.IntegerField(default=1, db_index=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Side event link"
        verbose_name_plural = "Side event links"
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['parent_event', 'side_event'],
                name='unique_parent_side_event',
            ),
        ]
        indexes = [
            models.Index(fields=['parent_event', 'order']),
            models.Index(fields=['side_event', 'order']),
        ]

    def __str__(self):
        try:
            return f"{self.parent_event} -> {self.side_event} ({self.label})"
        except Exception:
            return f"EventSideEvent #{self.pk}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.parent_event_id and self.side_event_id:
            if self.parent_event_id == self.side_event_id:
                raise ValidationError(
                    "An event cannot be a side event of itself.")
            # Prevent chains: a side event cannot itself be a parent of
            # another event. So the prospective parent must not already
            # be a side event of some other parent.
            if EventSideEvent.objects.filter(
                side_event_id=self.parent_event_id
            ).exclude(pk=self.pk if self.pk else None).exists():
                raise ValidationError(
                    "Side events cannot have their own side events. "
                    "The parent event is already a side event of "
                    "another event.")
            # Prevent circular relationships: the prospective side event
            # must not already be the parent of the prospective parent.
            if EventSideEvent.objects.filter(
                parent_event_id=self.side_event_id,
                side_event_id=self.parent_event_id
            ).exclude(pk=self.pk if self.pk else None).exists():
                raise ValidationError(
                    "Circular side-event relationships are not allowed.")

    def save(self, *args, **kwargs):
        # Run model-level validation before persisting.
        self.full_clean()
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new EventSideEvent: ID={self.pk}, "
                f"parent={self.parent_event_id}, side={self.side_event_id}")
        else:
            logger.info(
                f"Updated EventSideEvent: ID={self.pk}, "
                f"parent={self.parent_event_id}, side={self.side_event_id}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete EventSideEvent: ID={self.pk}, "
            f"parent={self.parent_event_id}, side={self.side_event_id}")
        result = super().delete(*args, **kwargs)
        logger.info(
            f"Deleted EventSideEvent: ID={self.pk}, "
            f"parent={self.parent_event_id}, side={self.side_event_id}")
        return result


class Partner(BaseModel):
    """
    Reusable partner/sponsor catalog entity.

    Partners (organizations that sponsor or co-host an event) are kept as
    a separate catalog so the same organization does not have to be
    re-created for each event.  The link to events is managed via the
    :class:`EventPartner` through model.

    Note:
    The legacy :class:`PartnerLogo` model is kept for backward
    compatibility and to preserve existing per-event partner logo data.
    New code should prefer linking events to :class:`Partner` records
    via :class:`EventPartner`.
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
        help_text="URL-friendly identifier for the partner",
        db_index=True,
    )
    logo = CloudinaryField(
        'image',
        folder='website/uploads/events/partners',
        null=True,
        blank=True,
        default=None,
        resource_type='image',
        chunk_size=5*1024*1024,
        timeout=600,
    )
    website_url = models.URLField(null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    order = models.IntegerField(default=1, db_index=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Partner"
        verbose_name_plural = "Partners"
        ordering = ['order', 'name']
        indexes = [
            models.Index(fields=['order', 'name']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        from django.utils.text import slugify as _slugify
        is_new = self.pk is None
        if not self.slug and self.name:
            base = _slugify(self.name)[:240] or 'partner'
            candidate = base
            counter = 1
            PartnerModel = self.__class__
            while PartnerModel.objects.filter(
                slug=candidate
            ).exclude(pk=self.pk if self.pk else None).exists():
                candidate = f"{base}-{counter}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)
        if is_new:
            logger.info(f"Created new Partner: ID={self.pk}, Name={self.name}")
        else:
            logger.info(f"Updated Partner: ID={self.pk}, Name={self.name}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete Partner: ID={self.pk}, Name={self.name}")
        safe_destroy(self.logo, invalidate=True)
        result = super().delete(*args, **kwargs)
        logger.info(f"Deleted Partner: ID={self.pk}, Name={self.name}")
        return result


class EventPartner(BaseModel):
    """
    Through model linking an :class:`Event` to a :class:`Partner`.

    A single Partner can be linked to many Events, and a single Event can
    have many Partners.  The (event, partner) pair is unique to prevent
    duplicate links.

    Note on data safety:
    - Deleting an Event cascades the through rows for that event only;
      Partner records themselves are preserved.
    - Deleting a Partner cascades the through rows linking it to events;
      Event records themselves are preserved.
    """
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name='event_partner_links',
    )
    partner = models.ForeignKey(
        Partner,
        on_delete=models.CASCADE,
        related_name='event_links',
    )
    role = models.CharField(
        max_length=40,
        choices=[
            ('partner', 'Partner'),
            ('sponsor', 'Sponsor'),
            ('host', 'Host'),
            ('co-organizer', 'Co-organizer'),
            ('supporter', 'Supporter'),
        ],
        default='partner',
    )
    order = models.IntegerField(default=1, db_index=True)

    class Meta(BaseModel.Meta):
        verbose_name = "Event partner link"
        verbose_name_plural = "Event partner links"
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'partner'],
                name='unique_event_partner',
            ),
        ]
        indexes = [
            models.Index(fields=['event', 'order']),
            models.Index(fields=['partner', 'order']),
        ]

    def __str__(self):
        try:
            return f"{self.partner} - {self.event} ({self.role})"
        except Exception:
            return f"EventPartner #{self.pk}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            logger.info(
                f"Created new EventPartner: ID={self.pk}, "
                f"Event={self.event_id}, Partner={self.partner_id}")
        else:
            logger.info(
                f"Updated EventPartner: ID={self.pk}, "
                f"Event={self.event_id}, Partner={self.partner_id}")

    def delete(self, *args, **kwargs):
        logger.debug(
            f"Attempting to delete EventPartner: ID={self.pk}, "
            f"Event={self.event_id}, Partner={self.partner_id}")
        result = super().delete(*args, **kwargs)
        logger.info(
            f"Deleted EventPartner: ID={self.pk}, "
            f"Event={self.event_id}, Partner={self.partner_id}")
        return result
