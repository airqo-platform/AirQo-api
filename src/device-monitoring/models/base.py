from config.db_connection import connect_mongo


class BaseModel:
    __abstract__ = True

    def __init__(self, tenant, collection_name):
        self.tenant = tenant.lower()
        self.collection_name = collection_name
        self.db = self._connect()
        self.collection = self.db[collection_name]

    def _connect(self):
        return connect_mongo(self.tenant)

    def __repr__(self):
        return f"{self.__class__.__name__}({self.tenant}, {self.collection_name})"
