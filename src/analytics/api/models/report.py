from api.models.base.base_model import BasePyMongoModel


class ReportModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="reports")

    def get_all_reports(self):
        return self.project(_id="$toString", name=1, user_id=1, body=1).exec()
