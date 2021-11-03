from datetime import datetime

# Third-party libraries
from flask_restx import Resource
from flask import request

# Middlewares
from main import rest_api

# models
from api.models import ReportModel, ReportAssetModel

# schema
from api.views.schemas import ReportSchema, ReportAttributeSchema

# Utils
from api.utils.http import create_response, Status
from api.utils.request_validators import validate_request_params


@rest_api.route('/reports')
class ReportResource(Resource):

    def post(self):
        tenant = request.args.get("tenant")

        report_schema = ReportSchema()
        data = report_schema.load(request.get_json())

        report_model = ReportModel(tenant)

        report_model.save(data)

        return create_response("Report successfully created", data=report_schema.dump(data)), Status.HTTP_201_CREATED

    def get(self):
        tenant = request.args.get("tenant")
        report_model = ReportModel(tenant)
        data = report_model.get_all_reports()

        return create_response("Report(s) successfully fetched", data=data), Status.HTTP_200_OK


@rest_api.route('/reports/<report_id>')
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


@rest_api.route('/reports/attribute/data')
class ReportAttributeDataResource(Resource):

    @validate_request_params('startDate|required:datetime', 'endDate|required:datetime')
    def get(self):
        tenant = request.args.get("tenant")
        start_date = request.args.get("startDate")
        end_date = request.args.get("endDate")
        attribute_schema = ReportAttributeSchema()
        data = attribute_schema.load(request.get_json())

        asset_model = ReportAssetModel(tenant, data['asset'], 'main')

        table_data = asset_model.get_data(start_date=start_date, end_date=end_date, data=data, date_key='createdAt')

        return create_response("Report(s) successfully fetched", data=table_data), Status.HTTP_200_OK
