from api.models.base.base_model import BasePyMongoModel


class ReportModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="reports")
