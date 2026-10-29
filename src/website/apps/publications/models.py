import re
from urllib.parse import urlsplit

from cloudinary.models import CloudinaryField
from django.core.exceptions import ValidationError
from django.db import models
from utils.models import BaseModel, SlugBaseModel
from utils.cloudinary import safe_destroy


class Publication(SlugBaseModel):
    class CategoryTypes(models.TextChoices):
        RESEARCH = "research", "Research"
        TECHNICAL = "technical", "Technical"
        POLICY = "policy", "Policy"
        GUIDE = "guide", "Guide"
        MANUAL = "manual", "Manual"

    # Slug configuration
    SLUG_SOURCE_FIELD = 'title'
    SLUG_USE_DATE = True
    SLUG_USE_LOCATION = False
    SLUG_MAX_LENGTH = 100

    title = models.CharField(max_length=255)
    authors = models.TextField(null=True, blank=True)
    description = models.TextField(
        null=True, blank=True, help_text="Optional description of the publication"
    )
    link = models.URLField(null=True, blank=True)
    resource_file = CloudinaryField(
        folder="website/uploads/publications/files",
        resource_type="raw",
        null=True,
        blank=True,
        chunk_size=5*1024*1024,  # 5MB chunks for large files
        timeout=600,  # 10 minutes timeout
    )
    link_title = models.CharField(
        max_length=100, default="Read More", null=True, blank=True
    )
    category = models.CharField(
        max_length=40,
        default=CategoryTypes.RESEARCH,
        choices=CategoryTypes.choices,
        null=True,
        blank=True,
    )
    order = models.IntegerField(default=1, db_index=True)

    class Meta(SlugBaseModel.Meta):
        ordering = ["order", "-id"]

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        """
        Override the delete method to remove the associated Cloudinary file before deletion.
        """
        safe_destroy(self.resource_file, invalidate=True, resource_type="raw")
        result = super().delete(*args, **kwargs)
        return result


class LivePublicationOverride(models.Model):
    """Staff-managed metadata corrections for external live-feed records.

    ``external_identifier`` is either ``doi:<normalized-doi>`` or
    ``openalex:<work-id>``. These keys are independent of provider response
    ordering and remain stable when OpenAlex and Crossref records are merged.
    """

    external_identifier = models.CharField(
        max_length=255,
        unique=True,
        help_text=(
            "Use doi:<doi> (for example doi:10.1234/example), or "
            "openalex:<work-id> (for example openalex:W123456789)."
        ),
    )
    authors = models.TextField(
        blank=True,
        help_text="Optional author override. Enter one author per line.",
    )
    journal = models.CharField(
        max_length=255,
        blank=True,
        help_text="Optional publication source, journal, or venue override.",
    )
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["external_identifier"]
        verbose_name = "live publication metadata override"
        verbose_name_plural = "live publication metadata overrides"

    def __str__(self):
        return self.external_identifier


DEFAULT_OPENALEX_AUTHOR_IDS = """A5047583981
A5051886991
A5076584166
A5002704292
A5014863511
A5017420345
A5015937838
A5067893766
A5089230857
A5036111960"""

DEFAULT_PUBLICATION_RELEVANCE_KEYWORDS = """air
air quality
air pollution
pollution
pm2.5
pm 2.5
pm10
pm 10
particulate matter
sensor
monitoring
clean air
atmospheric"""

DEFAULT_OPENALEX_API_URL = "https://api.openalex.org/works"
DEFAULT_CROSSREF_API_URL = "https://api.crossref.org/works"
DEFAULT_CROSSREF_MAILTO = "info@airqo.net"


def validate_provider_endpoint(value, expected_hostname):
    """Keep admin-configured provider URLs on the intended HTTPS host."""
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as exc:
        raise ValidationError("Enter a valid provider URL.") from exc

    if (
        parsed.scheme != "https"
        or parsed.hostname != expected_hostname
        or parsed.username
        or parsed.password
        or port
        or parsed.query
        or parsed.fragment
        or parsed.path.rstrip("/") != "/works"
    ):
        raise ValidationError(
            f"Use the official HTTPS {expected_hostname}/works endpoint."
        )


def split_feed_setting_values(value, *, split_commas=True):
    """Parse admin-entered feed settings with optional comma splitting."""
    values = []
    seen = set()
    pattern = r"[,\r\n]+" if split_commas else r"[\r\n]+"
    for item in re.split(pattern, value or ""):
        item = item.strip()
        key = item.casefold()
        if item and key not in seen:
            seen.add(key)
            values.append(item)
    return values


class LivePublicationFeedSettings(models.Model):
    """Singleton policy that controls which external publications are shown."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    enabled = models.BooleanField(default=True)
    openalex_author_ids = models.TextField(
        default=DEFAULT_OPENALEX_AUTHOR_IDS,
        blank=True,
        help_text=(
            "OpenAlex author IDs, one per line or comma-separated. Use IDs such as "
            "A5047583981. Leave empty to search using configured affiliations or keywords."
        ),
    )
    allowed_affiliations = models.TextField(
        default="AirQo",
        blank=True,
        help_text=(
            "Affiliation names to search in Crossref and match in provider results, "
            "one per line. These are independent of the OpenAlex author IDs."
        ),
    )
    relevance_keywords = models.TextField(
        default=DEFAULT_PUBLICATION_RELEVANCE_KEYWORDS,
        blank=True,
        help_text=(
            "Publication title or abstract terms that qualify a work, one per line. "
            "A work is shown when its title or abstract matches a keyword OR an "
            "author affiliation matches an allowed affiliation when relevance is "
            "required."
        ),
    )
    relevance_required = models.BooleanField(
        default=True,
        help_text=(
            "Require an allowed affiliation or relevance keyword before a work "
            "is shown. Disable this only when all works returned for the configured "
            "author or affiliation queries should be displayed."
        ),
    )
    openalex_api_url = models.URLField(
        default=DEFAULT_OPENALEX_API_URL,
        help_text="Official OpenAlex works endpoint.",
    )
    crossref_api_url = models.URLField(
        default=DEFAULT_CROSSREF_API_URL,
        help_text="Official Crossref works endpoint.",
    )
    crossref_mailto = models.EmailField(
        default=DEFAULT_CROSSREF_MAILTO,
        blank=True,
        help_text="Optional contact email sent to Crossref for polite-pool access.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "AirQo publication feed setting"
        verbose_name_plural = "AirQo publication feed settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        return super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls, create=False):
        """Return the policy row, optionally creating it for trusted callers."""
        if create:
            settings, _ = cls.objects.get_or_create(pk=1)
            return settings
        return cls.objects.filter(pk=1).first()

    def clean(self):
        super().clean()

        author_ids = split_feed_setting_values(self.openalex_author_ids)
        invalid_author_ids = [
            author_id
            for author_id in author_ids
            if not re.fullmatch(r"A\d+", author_id, flags=re.IGNORECASE)
        ]
        if invalid_author_ids:
            raise ValidationError(
                {
                    "openalex_author_ids": (
                        "Enter OpenAlex author IDs in the form A1234567890."
                    )
                }
            )
        if len(author_ids) > 100:
            raise ValidationError(
                {"openalex_author_ids": "At most 100 author IDs may be configured."}
            )
        affiliation_count = len(
            split_feed_setting_values(self.allowed_affiliations, split_commas=False)
        )
        if affiliation_count > 5:
            raise ValidationError(
                {"allowed_affiliations": "At most 5 affiliations may be configured."}
            )
        keyword_count = len(
            split_feed_setting_values(self.relevance_keywords, split_commas=False)
        )
        if keyword_count > 30:
            raise ValidationError(
                {"relevance_keywords": "At most 30 keywords may be configured."}
            )

        validate_provider_endpoint(self.openalex_api_url, "api.openalex.org")
        validate_provider_endpoint(self.crossref_api_url, "api.crossref.org")

    @property
    def openalex_author_id_list(self):
        return [
            author_id.upper()
            for author_id in split_feed_setting_values(self.openalex_author_ids)
            if re.fullmatch(r"A\d+", author_id, flags=re.IGNORECASE)
        ]

    @property
    def allowed_affiliation_list(self):
        return split_feed_setting_values(
            self.allowed_affiliations, split_commas=False
        )

    @property
    def relevance_keyword_list(self):
        return split_feed_setting_values(
            self.relevance_keywords, split_commas=False
        )

    def __str__(self):
        return "AirQo research publications"
