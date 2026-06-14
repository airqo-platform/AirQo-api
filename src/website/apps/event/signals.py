"""
Event app signals — invalidate event caches when through-model
records (organizer links, side-event links, partner links) change.

Without this, linking an event as a side event (or adding/removing
an organizer or partner) leaves stale data in the list cache until
the TTL expires.
"""
import logging

from django.db.models.signals import post_save, post_delete
from django.core.cache import cache

from .models import EventSideEvent, EventOrganizer, EventPartner

logger = logging.getLogger(__name__)


def _clear_event_caches(sender, **kwargs):
    """
    Clear all event-related cache entries.

    Uses cache.clear() because LocMemCache does not support
    prefix-based deletion.  This is safe because:
    - The cache is in-memory and rebuilds on next request.
    - The TTL is short (5–10 min) anyway.
    """
    try:
        cache.clear()
        logger.debug(
            "Event caches cleared after %s change.", sender.__name__
        )
    except Exception:
        logger.exception("Failed to clear event caches")


# Register for all three through models so any organizer / side-event
# / partner link change triggers cache invalidation.
for _model in (EventSideEvent, EventOrganizer, EventPartner):
    post_save.connect(_clear_event_caches, sender=_model)
    post_delete.connect(_clear_event_caches, sender=_model)
