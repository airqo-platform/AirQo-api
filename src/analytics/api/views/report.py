from datetime import datetime

# Third-party libraries
from flask_restx import Resource
from flask import request

# Middlewares
from main import rest_api

# models
from api.models import ReportModel

# schema
from api.views.schemas import ReportSchema

# Utils
from api.utils.http import create_response, Status


@rest_api.route('/report')
class ReportResource(Resource):

    def post(self):
        tenant = request.args.get("tenant")

        report_schema = ReportSchema()
        data = report_schema.load(request.get_json())

        report_model = ReportModel(tenant)

        report_model.save(data)

        data["_id"] = str(data["_id"])

        return create_response("Report successfully created", data=data), Status.HTTP_201_CREATED

    def get(self):
        tenant = request.args.get("tenant")
        report_model = ReportModel(tenant)
        data = report_model.get_all_reports()

        return create_response("Report(s) successfully fetched", data=data), Status.HTTP_200_OK


@rest_api.route('/report/<report_id>')
class SingleReportResource(Resource):

    def get(self, report_id):
        tenant = request.args.get("tenant")
        report_model = ReportModel(tenant)
        data = report_model.get_report(report_id)

        return create_response("Report(s) successfully fetched", data=data), Status.HTTP_200_OK

    def patch(self, report_id):
        tenant = request.args.get("tenant")

        report_schema = ReportSchema()
        data = report_schema.load(request.get_json(), partial=True)

        report_model = ReportModel(tenant)

        update_result = report_model.update_report(report_id, data)

        print(dir(update_result))

        if update_result.modified_count > 0:
            return create_response(
                "report successfully updated",
                hide_data=True
            ), Status.HTTP_200_OK

        return create_response("report not modified", success=False, hide_data=True), Status.HTTP_202_ACCEPTED

    def delete(self, report_id):
        tenant = request.args.get("tenant")

        report_model = ReportModel(tenant)

        delete_result = report_model.delete_report(report_id)

        if delete_result.deleted_count > 0:
            return create_response(
                f"monthly report {report_id} deleted successfully",
                hide_data=True
            ), Status.HTTP_200_OK

        return create_response("report not found", success=False, hide_data=True), Status.HTTP_404_NOT_FOUND
