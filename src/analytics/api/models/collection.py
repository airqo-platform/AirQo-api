from api.models.base.base_model import BasePyMongoModel


class Collection(BasePyMongoModel):
    def __init__(self, tenant, collection_name):
        super().__init__(tenant, collection_name=collection_name)
