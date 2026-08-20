"""
Framework-free MongoDB base model for the FastAPI stack.

Drop-in replacement for the Flask-era BasePyMongoModel (base_model.py),
which reads the legacy config.py.  This one reads config.settings,
so models built on it can run on both the API request path (via
asyncio.to_thread — pymongo is synchronous) and the Celery worker.

Inherits the chainable aggregation-pipeline vocabulary from
ModelOperations (date_range, unwind, lookup, group, match_in, exec, ...).
"""

from functools import lru_cache

from pymongo import MongoClient

from api.models.base.model_operations import ModelOperations
import config


@lru_cache(maxsize=4)
def _shared_client(uri: str) -> MongoClient:
    """One MongoClient (connection pool) per URI for the whole process.

    Models are constructed per request; without this every call would spin
    up its own pool and monitor threads.
    """
    return MongoClient(uri)


class FastAPIPyMongoModel(ModelOperations):
    """
    Per-network collection handle: database f"{mongo_db_name}_{network}".

    "network" is what the old "tenant" concept is now called; the database
    naming on disk is unchanged, only the parameter name.
    """

    def __init__(self, network: str, collection_name: str):
        super().__init__()
        self.network = (network or "airqo").lower()
        self.collection_name = collection_name
        # settings is resolved at call time so tests can swap config.settings
        settings = config.settings
        client = _shared_client(settings.mongo_uri)
        self.db = client[f"{settings.mongo_db_name}_{self.network}"]
        self.collection = self.db[collection_name]
