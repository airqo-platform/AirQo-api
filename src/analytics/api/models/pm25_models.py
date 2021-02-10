from api.models.base.base_model import BasePyMongoModel


class PM25LocationCategoryCount(BasePyMongoModel):

    def __init__(self, tenant):
        super().__init__(tenant, collection_name="pm25_location_categorycount")
