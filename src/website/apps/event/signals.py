"""
Event app signals — invalidate event caches when related models change.

Covers through-models (EventSideEvent, EventOrganizer, EventPartner)
and catalog models (Organizer, Partner) so that editing any of these
immediately reflects in event list/detail responses.

Cache invalidation is deferred to transaction.on_commit() so that a
concurrent read cannot repopulate the cache with pre-commit data.
"""
import logging

from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.core.cache import cache

from .models import (
    EventSideEvent, EventOrganizer, EventPartner,
    Organizer, Partner,
)

logger = logging.getLogger(__name__)


def _clear_event_caches(sender, **kwargs):
    """
    Clear all event-related cache entries after the current
    transaction commits successfully.

    Uses cache.clear() because LocMemCache does not support
    prefix-based deletion.  This is safe because:
    - The cache is in-memory and rebuilds on next request.
    - The TTL is short (5-10 min) anyway.
    """
    def _invalidate():
        try:
            cache.clear()
            logger.debug(
                "Event caches cleared after %s change.", sender.__name__
            )
        except Exception:
            logger.exception("Failed to clear event caches")

    transaction.on_commit(_invalidate)


# Register for through models and catalog models so any change
# to organizers, side events, or partners triggers cache invalidation.
for _model in (
    EventSideEvent, EventOrganizer, EventPartner,
    Organizer, Partner,
):
    post_save.connect(_clear_event_caches, sender=_model)
    post_delete.connect(_clear_event_caches, sender=_model)
