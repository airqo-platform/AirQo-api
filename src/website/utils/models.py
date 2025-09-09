from django.db import models
from django.utils.text import slugify
from typing import Optional, Any
import uuid


class BaseModel(models.Model):
    """Base model with soft delete functionality"""
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        abstract = True


class SlugBaseModel(BaseModel):
    """
    Enhanced base model with universal slug support for privacy-friendly URLs
    """
    # Slug fields
    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
        help_text="URL-friendly identifier",
        db_index=True
    )

    # Configuration - Override in child models
    SLUG_SOURCE_FIELD = 'title'  # Primary field to generate slug from
    SLUG_USE_DATE = True         # Include date in slug generation
    SLUG_USE_LOCATION = False    # Include location if available
    SLUG_MAX_LENGTH = 100        # Maximum length for generated slug base

    class Meta(BaseModel.Meta):
        abstract = True

    def generate_slug_base(self) -> str:
        """Generate the base slug from model fields"""
        parts = []

        # Primary source field (title, name, etc.)
        if hasattr(self, self.SLUG_SOURCE_FIELD):
            source_value = getattr(self, self.SLUG_SOURCE_FIELD, None)
            if source_value:
                # Truncate if too long
                source_str = str(source_value)[:self.SLUG_MAX_LENGTH]
                parts.append(source_str)

        # Date component
        if self.SLUG_USE_DATE:
            start_date = getattr(self, 'start_date', None)
            if start_date:
                parts.append(str(start_date.year))
            else:
                date_published = getattr(self, 'date_published', None)
                if date_published:
                    parts.append(str(date_published.year))
                elif hasattr(self, 'created') and self.created:
                    parts.append(str(self.created.year))

        # Location component
        if self.SLUG_USE_LOCATION:
            location_name = getattr(self, 'location_name', None)
            if location_name:
                location_str = str(location_name)[:20]  # Keep location short
                parts.append(location_str)
            else:
                city = getattr(self, 'city', None)
                if city:
                    city_str = str(city)[:20]
                    parts.append(city_str)

        # Fallback to UUID if no parts
        if not parts:
            return str(uuid.uuid4())[:8]

        return ' '.join(parts)

    def make_slug_unique(self, base_slug):
        """Ensure slug uniqueness across the model"""
        model_class = self.__class__
        unique_slug = base_slug
        counter = 1

        # Check for existing slugs, excluding current instance
        while model_class.objects.filter(
            slug=unique_slug
        ).exclude(
            pk=self.pk if self.pk else None
        ).exists():
            unique_slug = f"{base_slug}-{counter}"
            counter += 1

        return unique_slug

    def generate_fresh_slug(self):
        """Generate a completely new slug"""
        base_text = self.generate_slug_base()
        base_slug = slugify(base_text)
        return self.make_slug_unique(base_slug)

    def save(self, *args, **kwargs):
        """Auto-generate slug if not provided"""
        if not self.slug:
            self.slug = self.generate_fresh_slug()

        super().save(*args, **kwargs)

    def get_absolute_url(self):
        """Generate API URL for the instance"""
        model_name = self.__class__.__name__.lower()
        # Handle plural forms
        plural_name = f"{model_name}s" if not model_name.endswith(
            's') else model_name
        return f"/website/api/v2/{plural_name}/{self.slug}/"

    def get_public_identifier(self) -> str:
        """Return the public identifier (slug or fallback to id)"""
        if self.slug:
            return self.slug
        instance_id = getattr(self, 'id', None)
        return str(instance_id) if instance_id else 'unknown'

    @property
    def has_slug(self):
        """Check if instance has a slug"""
        return bool(self.slug)

    def __str__(self) -> str:
        """Enhanced string representation"""
        if hasattr(self, self.SLUG_SOURCE_FIELD):
            source_value = getattr(self, self.SLUG_SOURCE_FIELD, None)
            if source_value:
                return str(source_value)
        instance_id = getattr(self, 'id', None)
        return f"{self.__class__.__name__} #{instance_id}" if instance_id else f"{self.__class__.__name__}"
