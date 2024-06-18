from flasgger import swag_from
from flask_restx import Namespace, Resource
from marshmallow import ValidationError

from models.base.data_processing import air_quality_data
from utils.http import create_response, Status
from utils.validators.report import AutoReportSchema

auto_report_api = Namespace(name="auto-report", description="Auto Report API", path="/")


@auto_report_api.route("/grid/report")
class GridReportResource(Resource):
    @swag_from("/api/docs/report/generate_grid_report_post.yml")
    def post(self):
        try:
            json_data = AutoReportSchema().load(auto_report_api.payload)
        except ValidationError as err:
            return (
                create_response(f" {err.messages}", success=False),
                Status.HTTP_400_BAD_REQUEST,
            )
        return air_quality_data(json_data)
