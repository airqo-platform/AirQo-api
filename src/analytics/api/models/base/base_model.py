from decouple import config as env_var
from pymongo import MongoClient

from config import config
from .model_operations import ModelOperations

APP_CONFIG = config.get(env_var("FLASK_ENV"))


class BasePyMongoModel(ModelOperations):
    """base model for all database models"""

    __abstract__ = True

    def __init__(self, tenant, collection_name):
        self.tenant = tenant.lower()
        self.db = self._connect()
        self.collection = self.db[collection_name]

    def _connect(self):
        client = MongoClient(APP_CONFIG.MONGO_URI)
        db = client[f'{APP_CONFIG.DB_NAME}_{self.tenant}']
        return db
