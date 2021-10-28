from api.models.base.base_model import BasePyMongoModel


class ReportModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="reports")

    def get_all_reports(self):
        return self.project(_id="$toString", name=1, user_id=1, attributes=1).exec()

    def get_report(self, report_id):
        return (
            self
                .filter_by(_id=self.to_object_id(report_id))
                .project(_id="$toString", name=1, user_id=1, attributes=1)
                .exec()
        )

    def delete_report(self, report_id):
        return self.delete_one({"_id": self.to_object_id(report_id)})
