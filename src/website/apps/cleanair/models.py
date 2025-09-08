# models.py

from django.db import models
from django_quill.fields import QuillField
from utils.models import BaseModel
from django.db.models.signals import pre_save
from django.dispatch import receiver
from enum import Enum
from django.utils.text import slugify
from cloudinary.models import CloudinaryField
from django.db.models.signals import post_save
from multiselectfield import MultiSelectField


class CleanAirResource(BaseModel):
    resource_title = models.CharField(max_length=120)
    resource_link = models.URLField(null=True, blank=True)
    resource_file = CloudinaryField(
        'resource_file',
        resource_type='raw',
        folder='website/uploads/cleanair/resources/',
        null=True,
        blank=True
    )
    author_title = models.CharField(
        max_length=40, null=True, blank=True, default="Created By"
    )

    class ResourceCategory(models.TextChoices):
        TOOLKIT = "toolkit", "ToolKit"
        TECHNICAL_REPORT = "technical_report", "Technical Report"
        WORKSHOP_REPORT = "workshop_report", "Workshop Report"
        RESEARCH_PUBLICATION = "research_publication", "Research Publication"

    resource_category = models.CharField(
        max_length=40,
        default=ResourceCategory.TECHNICAL_REPORT,
        choices=ResourceCategory.choices,
        null=False,
        blank=False
    )
    resource_authors = models.CharField(max_length=200, default="AirQo")
    order = models.IntegerField(default=1)

    class Meta(BaseModel.Meta):
        ordering = ['order', '-id']
        verbose_name = "Clean Air Resource"
        verbose_name_plural = "Clean Air Resources"

    def __str__(self):
        return self.resource_title


class ForumEvent(BaseModel):
    title = models.CharField(max_length=100, default="CLEAN-Air Forum")
    title_subtext = models.TextField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=True, null=True)
    introduction = QuillField(blank=True, null=True,
                              default="No details available yet.")
    speakers_text_section = QuillField(
        blank=True, null=True, default="No details available yet.")
    committee_text_section = QuillField(
        blank=True, null=True, default="No details available yet.")
    partners_text_section = QuillField(
        blank=True, null=True, default="No details available yet.")
    registration_link = models.URLField(blank=True)
    schedule_details = QuillField(
        blank=True, null=True, default="No details available yet.")
    registration_details = QuillField(
        blank=True, null=True, default="No details available yet.")
    sponsorship_opportunities_about = QuillField(
        blank=True, null=True, default="No details available yet.")
    sponsorship_opportunities_schedule = QuillField(
        blank=True, null=True, default="No details available yet.")
    sponsorship_opportunities_partners = QuillField(
        blank=True, null=True, default="No details available yet.")
    sponsorship_packages = QuillField(
        blank=True, null=True, default="No details available yet.")
    travel_logistics_vaccination_details = QuillField(
        blank=True, null=True, default="No details available yet.")
    travel_logistics_visa_details = QuillField(
        blank=True, null=True, default="No details available yet.")
    travel_logistics_accommodation_details = QuillField(
        blank=True, null=True, default="No details available yet.")
    glossary_details = QuillField(
        blank=True, null=True, default="No details available yet.")
    unique_title = models.CharField(max_length=100, blank=True, unique=True)
    background_image = CloudinaryField(
        'background_image',
        folder='website/uploads/events/images/',
        resource_type='image',
        null=True,
        blank=True
    )
    location_name = models.CharField(max_length=100, blank=True)
    location_link = models.URLField(blank=True)
    order = models.IntegerField(default=1)

    class Meta(BaseModel.Meta):
        ordering = ['order', '-id']
        verbose_name = "Forum Event"
        verbose_name_plural = "Clean Air Forum Events"

    def __str__(self):
        return self.title

    def generate_unique_title(self):
        """
        Generate a unique slug from the title.
        Assumes title is formatted like:
            "CLEAN-Air Forum 2024, Lagos, Nigeria"
        and uses the portion before the first comma.
        """
        base_title = self.title.split(",")[0]  # e.g., "CLEAN-Air Forum 2024"
        # becomes "clean-air-forum-2024"
        slug_base = slugify(base_title)
        unique_slug = slug_base
        postfix_index = 0

        # Exclude the current instance (if updating) from the uniqueness check.
        while ForumEvent.objects.filter(unique_title=unique_slug).exclude(pk=self.pk).exists():
            postfix_index += 1
            unique_slug = f"{slug_base}-{postfix_index}"

        return unique_slug

    def save(self, *args, **kwargs):
        if not self.unique_title:
            self.unique_title = self.generate_unique_title()
        super().save(*args, **kwargs)


class Section(models.Model):
    # Section type choices.
    SPLIT = 'split'
    COLUMN = 'column'
    SECTION_TYPE_CHOICES = [
        (SPLIT, 'Split Section'),
        (COLUMN, 'Column Section'),
    ]

    # Define the page choices.
    PAGE_ABOUT = 'about'
    PAGE_COMMITTEE = 'committee'
    PAGE_SESSION = 'session'
    PAGE_SPEAKERS = 'speakers'
    PAGE_PARTNERS = 'partners'
    PAGE_SPONSORSHIPS = 'sponsorships'
    PAGE_LOGISTICS = 'logistics'
    PAGE_GLOSSARY = 'glossary'
    PAGE_CHOICES = [
        (PAGE_ABOUT, 'About Page'),
        (PAGE_COMMITTEE, 'Committee Page'),
        (PAGE_SESSION, 'Session Page'),
        (PAGE_SPEAKERS, 'Speakers Page'),
        (PAGE_PARTNERS, 'Partners Page'),
        (PAGE_SPONSORSHIPS, 'Sponsorships Page'),
        (PAGE_LOGISTICS, 'Logistics Page'),
        (PAGE_GLOSSARY, 'Glossary Page'),
    ]

    # A section can belong to multiple forum events.
    forum_events = models.ManyToManyField(
        ForumEvent,
        related_name='sections',
        blank=True
    )
    # Allow title to be empty.
    title = models.TextField(blank=True, help_text="Section title (optional)")
    content = QuillField(blank=True, null=True, default="")
    section_type = models.CharField(
        max_length=10,
        choices=SECTION_TYPE_CHOICES,
        default=COLUMN,
        help_text="Select whether this is a split section (title on left, content on right) or a column section."
    )
    reverse_order = models.BooleanField(
        default=False,
        help_text="If checked, the layout for a split section will be reversed (content on left, title on right)."
    )
    pages = MultiSelectField(
        choices=PAGE_CHOICES,
        default=[PAGE_ABOUT],
        help_text="Select the page(s) where this section should be displayed."
    )
    order = models.IntegerField(default=1)

    class Meta:
        ordering = ['order', '-id']

    def __str__(self):
        # Join the titles of related forum events.
        events = ", ".join([fe.title for fe in self.forum_events.all()])
        # If title is not empty, return the first 50 characters; otherwise, show "(Untitled)".
        if self.title.strip():
            return f"Section for {events}: {self.title[:50]}"
        return f"Section for {events}: (Untitled)"


class PartnerCategoryChoices(Enum):
    FUNDING_PARTNER = "Funding Partner"
    HOST_PARTNER = "Host Partner"
    CO_CONVENING_PARTNER = "Co-Convening Partner"
    SPONSOR_PARTNER = "Sponsor Partner"
    PROGRAM_PARTNER = "Program Partner"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class CategoryChoices(Enum):
    SPEAKER = "Speaker"
    COMMITTEE_MEMBER = "Committee Member"
    KEY_NOTE_SPEAKER = "Key Note Speaker"
    PLENARY_SPEAKER = "Plenary Speaker"
    SPEAKER_AND_COMMITTEE_MEMBER = "Speaker and Committee Member"
    COMMITTEE_MEMBER_AND_KEY_NOTE_SPEAKER = "Committee Member and Key Note Speaker"
    PLENARY_AND_COMMITTEE_MEMBER = "Plenary and Committee Member"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class Engagement(BaseModel):
    title = models.CharField(max_length=200)
    forum_event = models.OneToOneField(
        ForumEvent, null=True, blank=True, related_name="engagement", on_delete=models.SET_NULL,
    )

    def __str__(self):
        return self.title


class Objective(BaseModel):
    title = models.CharField(max_length=200)
    details = models.TextField(blank=True, null=True)
    engagement = models.ForeignKey(
        Engagement, null=True, blank=True, related_name="objectives", on_delete=models.CASCADE,
    )
    order = models.PositiveIntegerField(default=0, blank=False, null=False)

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        return self.title


class Partner(BaseModel):
    partner_logo = CloudinaryField(
        'partner_logo',
        folder='website/uploads/cleanair/partners/',
        resource_type='image',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=70)
    website_link = models.URLField(blank=True, null=True)
    order = models.IntegerField(default=1)
    category = models.CharField(
        max_length=50,
        choices=PartnerCategoryChoices.choices(),
        default=PartnerCategoryChoices.FUNDING_PARTNER.value
    )
    # Change: Use a ManyToManyField to ForumEvent.
    forum_events = models.ManyToManyField(
        'ForumEvent',
        related_name="partners",
        blank=True
    )
    authored_by = models.ForeignKey(
        'auth.User',
        related_name='cleanair_partner_authored_by',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        # If no specific events are selected, interpret that as "All Events"
        # Use getattr to access the Django-generated helper method safely for
        # static type checkers. Fall back to the raw category value if the
        # helper isn't available in this analysis environment.
        category_display = getattr(self, 'get_category_display', lambda: self.category)()
        if self.forum_events.count() == 0:
            return f"All Events - {category_display} - {self.name}"
        return f"{category_display} - {self.name}"


class Program(BaseModel):
    title = models.CharField(max_length=100)
    sub_text = QuillField(blank=True, null=True,
                          default="No details available yet.")
    order = models.IntegerField(default=1)
    forum_event = models.ForeignKey(
        ForumEvent, null=True, blank=True, related_name="programs", on_delete=models.SET_NULL
    )
    authored_by = models.ForeignKey(
        'auth.User', related_name='cleanair_program_authored_by', null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        return f"Program - {self.title}"


class Session(BaseModel):
    start_time = models.TimeField(blank=True, null=True)
    end_time = models.TimeField(blank=False, null=True)
    session_title = models.CharField(max_length=150)
    session_details = models.TextField(default="No details available yet.")
    order = models.IntegerField(default=1)
    program = models.ForeignKey(
        Program, null=True, blank=True, related_name="sessions", on_delete=models.SET_NULL
    )
    authored_by = models.ForeignKey(
        'auth.User', related_name='cleanair_session_authored_by', null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        return f"Session - {self.session_title}"


class Support(BaseModel):
    query = models.CharField(max_length=80)
    name = models.CharField(max_length=70)
    role = models.CharField(max_length=100, blank=True)
    email = models.EmailField()
    order = models.IntegerField(default=1)
    event = models.ForeignKey(
        ForumEvent, null=True, blank=True, related_name="supports", on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        return f"Support - {self.query}"


class Person(BaseModel):
    name = models.CharField(max_length=100)
    title = models.CharField(max_length=100, blank=True)
    bio = QuillField(
        blank=True,
        null=True,
        default="No details available yet."
    )
    category = models.CharField(
        max_length=50,
        choices=CategoryChoices.choices(),
        default=CategoryChoices.SPEAKER.value
    )
    picture = CloudinaryField(
        'picture',
        folder='website/uploads/cleanair/persons/',
        resource_type='image',
        null=True,
        blank=True
    )
    twitter = models.URLField(blank=True)
    linked_in = models.URLField(blank=True)
    order = models.IntegerField(default=1)
    # Use ManyToManyField to allow a person to belong to multiple events.
    # If left empty, we will interpret that as "belongs to all events".
    forum_events = models.ManyToManyField(
        ForumEvent,
        blank=True,
        related_name="persons"
    )

    class Meta(BaseModel.Meta):
        ordering = ['order', 'name']

    def __str__(self):
        # If no events are selected, we consider the person as belonging to all events.
        if self.forum_events.count() == 0:
            return f"{self.name} (All Events)"
        return self.name
# Signal: After a Person is saved, if no forum events have been assigned, assign all available ForumEvent objects.


@receiver(post_save, sender=Person)
def assign_all_forum_events(sender, instance, created, **kwargs):
    # You can choose to run this only for new instances by checking "created"
    # or run it every time the instance is saved if forum_events is empty.
    if instance.forum_events.count() == 0:
        all_events = ForumEvent.objects.all()
        instance.forum_events.set(all_events)


class ForumResource(BaseModel):
    resource_title = models.CharField(max_length=120)
    resource_authors = models.CharField(max_length=200, default="AirQo")
    order = models.IntegerField(default=1)
    forum_event = models.ForeignKey(
        'ForumEvent', null=True, blank=True, related_name="forum_resources", on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order', '-id']

    def __str__(self):
        return self.resource_title


class ResourceSession(BaseModel):
    session_title = models.CharField(max_length=120)
    forum_resource = models.ForeignKey(
    'ForumResource', related_name="resource_sessions", on_delete=models.CASCADE
    )
    order = models.IntegerField(default=1)

    class Meta(BaseModel.Meta):
        ordering = ['order', '-id']

    def __str__(self):
        return self.session_title


class ResourceFile(BaseModel):
    resource_summary = models.TextField(blank=True, null=True)
    file = CloudinaryField(
        'file',
        resource_type='raw',
        folder='website/uploads/cleanair/resources/',
        null=True,
        blank=True
    )
    session = models.ForeignKey(
    'ResourceSession', related_name='resource_files', on_delete=models.CASCADE, null=True, blank=True
    )
    order = models.IntegerField(default=1)

    class Meta(BaseModel.Meta):
        ordering = ['order', '-id']

    def __str__(self):
        return self.file.url if self.file else "No File"


# signals.py
@receiver(pre_save, sender=ForumEvent)
def append_short_name(sender, instance, *args, **kwargs):
    if not instance.unique_title:
        instance.unique_title = instance.generate_unique_title()
