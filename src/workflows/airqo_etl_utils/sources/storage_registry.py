from typing import Dict, Any


_STORAGE_REGISTRY: Dict[str, Any] = {}


def register_storage(name: str, backend: Any) -> None:
    """Register a storage backend by name."""
    _STORAGE_REGISTRY[name] = backend


def get_storage(name: str):
    """Retrieve a registered storage backend by name."""
    return _STORAGE_REGISTRY.get(name)


def get_default_storage():
    """Return the first registered storage if any."""
    if _STORAGE_REGISTRY:
        return next(iter(_STORAGE_REGISTRY.values()))
    return None
