from typing import Dict, Any


_STORAGE_REGISTRY: Dict[str, Any] = {}


def register_storage(name: str, backend: Any) -> None:
    _STORAGE_REGISTRY[name] = backend


def get_storage(name: str):
    return _STORAGE_REGISTRY.get(name)


def get_default_storage():
    if _STORAGE_REGISTRY:
        return next(iter(_STORAGE_REGISTRY.values()))
    return None


__all__ = ["register_storage", "get_storage", "get_default_storage"]
