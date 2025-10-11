"""
Universal Django signals for automatic slug generation
"""
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils.text import slugify
import logging

logger = logging.getLogger(__name__)


@receiver(pre_save)
def auto_generate_slug(sender, instance, **kwargs):
    """
    Universal signal to auto-generate slugs for any model that supports them.
    
    This signal automatically triggers before saving any model instance
    and generates a slug if:
    1. The model inherits from SlugBaseModel
    2. The instance doesn't already have a slug
    3. The model has the required slug generation methods
    """
    # Check if model has slug support
    if not hasattr(instance, 'slug'):
        return
    
    if not hasattr(instance, 'generate_slug_base'):
        return
    
    if not hasattr(instance, 'make_slug_unique'):
        return
    
    # Skip if slug already exists (unless it's empty)
    if instance.slug and instance.slug.strip():
        return
    
    try:
        # Generate slug using the model's methods
        base_text = instance.generate_slug_base()
        base_slug = slugify(base_text)
        
        if base_slug:  # Only proceed if we got a valid slug
            instance.slug = instance.make_slug_unique(base_slug)
            
            logger.debug(
                f"Auto-generated slug for {sender.__name__} #{instance.pk}: '{instance.slug}'"
            )
        else:
            logger.warning(
                f"Could not generate slug for {sender.__name__} #{instance.pk} - empty base text"
            )
            
    except Exception as e:
        logger.error(
            f"Error auto-generating slug for {sender.__name__} #{instance.pk}: {str(e)}"
        )
        # Don't raise exception - allow save to continue without slug
