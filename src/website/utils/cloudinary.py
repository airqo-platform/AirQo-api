import logging
from typing import Any, Optional

from cloudinary.uploader import destroy

logger = logging.getLogger(__name__)


def get_public_id(resource: Any) -> Optional[str]:
    """
    Extract Cloudinary public_id from a resource object or string.
    """
    if not resource:
        return None

    if isinstance(resource, str):
        return resource

    public_id = getattr(resource, "public_id", None)
    if public_id:
        return public_id

    # Some serializers/storage backends may expose a `name`.
    name = getattr(resource, "name", None)
    return name if isinstance(name, str) and name else None


def safe_destroy(resource: Any, *, invalidate: bool = True, resource_type: Optional[str] = None) -> bool:
    """
    Best-effort Cloudinary deletion that never raises.
    """
    public_id = get_public_id(resource)
    if not public_id:
        return False

    try:
        options = {"invalidate": invalidate}
        if resource_type:
            options["resource_type"] = resource_type
        destroy(public_id, **options)
        return True
    except Exception:
        logger.warning(
            "Cloudinary destroy failed for public_id=%s (resource_type=%s)",
            public_id,
            resource_type or "default",
            exc_info=True,
        )
        return False
