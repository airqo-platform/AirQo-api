from decouple import config as env_var
from pymongo import MongoClient

from config import config
from .model_operations import ModelOperations

APP_CONFIG = config.get(env_var("FLASK_ENV"))


class BasePyMongoModel(ModelOperations):
    """base model for all database models"""

    __abstract__ = True

    def __init__(self, tenant, collection_name):
        super().__init__()
        self.tenant = tenant.lower()
        self.collection_name = collection_name
        self.db = self._connect()
        self.collection = self.db[collection_name]

    def _connect(self):
        client = MongoClient(APP_CONFIG.MONGO_URI)
        db = client[f"{APP_CONFIG.DB_NAME}_{self.tenant}"]

        # lets hard code the db here for dev purposes
        # db = client['airqo_analytics']
        return db

    def __repr__(self):
        return f"{self.__class__.__name__}({self.tenant}, {self.collection_name})"
