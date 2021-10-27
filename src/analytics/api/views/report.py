from datetime import datetime

# Third-party libraries
from flasgger import swag_from
from flask_restx import Resource
from flask import request

# Middlewares
from main import rest_api

# models
from api.models import ReportModel

#schema
from api.views.schemas import ReportSchema

# Utils
from api.utils.request_validators import validate_request_params, validate_request_json
from api.utils.http import create_response, Status
from api.utils.case_converters import camel_to_snake


@rest_api.route('/report')
class ReportResource(Resource):

    def post(self):
        tenant = request.args.get("tenant")

        report_schema = ReportSchema()
        data = report_schema.load(request.get_json())

        report_model = ReportModel(tenant)

        report_model.save(data)

        return create_response("Report successfully created"), Status.HTTP_201_CREATED

    @swag_from('/api/docs/report/default_report_template_get.yml')
    def get(self):
        tenant = request.args.get("tenant")
        report_model = ReportTemplateModel(tenant)

        default_template = list(report_model.filter_by(report_type="default").exec(
            {
                "_id": 1,
                "user_id": 1,
                "report_date": {
                    '$dateToString': {
                        'format': '%Y-%m-%dT%H:%M:%S%z',
                        'date': '$time',
                        'timezone': 'Africa/Kampala'
                    },
                },
                "report_type": 1,
                "report_name": 1,
                "report_body": 1
            }
        ))

        report = default_template[0] if default_template else {}

        return create_response(
            "default report successfully fetched",
            data={'report': report}
        ), Status.HTTP_200_OK

    @swag_from('/api/docs/report/default_report_template_patch.yml')
    @validate_request_json('userId|str', 'reportName|str', 'reportBody|dict')
    def patch(self):
        tenant = request.args.get("tenant")

        data = request.get_json()

        update_fields = {}

        valid_keys = ['userId', 'reportName', 'reportBody']

        for key, value in data.items():
            if key in valid_keys:
                update_fields[camel_to_snake(key)] = value

        if not update_fields:
            return {
                       "message": f"the update fields is empty. valid keys are {valid_keys}"
                   }, Status.HTTP_400_BAD_REQUEST

        report_model = ReportTemplateModel(tenant)

        update_result = report_model.update_one(filter_cond={'report_type': 'default'}, update_fields=update_fields)

        if update_result.modified_count > 0 or update_result.matched_count > 0:
            return create_response("default reporting template updated successfully"), Status.HTTP_202_ACCEPTED

        return create_response(
            "could not update default template",
            success=False
        ), Status.HTTP_404_NOT_FOUND


@rest_api.route('/report/monthly')
class MonthlyReportResource(Resource):

    @swag_from('/api/docs/report/monthly_report_post.yml')
    @validate_request_json('userId|required:str', 'reportName|required:str', 'reportBody|required:dict')
    def post(self):
        tenant = request.args.get("tenant")

        data = request.get_json()
        user_id = data['userId']
        report_name = data['reportName']
        report_body = data['reportBody']

        report_model = ReportTemplateModel(tenant)

        report_model.insert({
            "user_id": user_id,
            "report_date": datetime.now(),
            "report_name": report_name,
            "report_body": report_body
        })

        return create_response("Monthly Report Saved Successfully"), Status.HTTP_201_CREATED

    @swag_from('/api/docs/report/monthly_report_get.yml')
    @validate_request_params('userId|required:str')
    def get(self):
        tenant = request.args.get("tenant")
        user_id = request.args.get("userId")

        report_model = ReportTemplateModel(tenant)

        report = list(report_model.filter_by(user_id=user_id).exec(
            {
                "_id": 1,
                "user_id": 1,
                "report_date": {
                    '$dateToString': {
                        'format': '%Y-%m-%dT%H:%M:%S%z',
                        'date': '$time',
                        'timezone': 'Africa/Kampala'
                    },
                },
                "report_type": 1,
                "report_name": 1,
                "report_body": 1
            }
        ))

        if report:
            return create_response(
                "reports successfully fetched",
                data={"reports": report}
            ), Status.HTTP_200_OK

        return create_response("report(s) not found", success=False), Status.HTTP_404_NOT_FOUND


@rest_api.route('/report/monthly/<report_name>')
class MonthlyReportExtraResource(Resource):

    @swag_from('/api/docs/report/monthly_report_extra_post.yml')
    @validate_request_json('userId|str', 'reportName|str', 'reportBody|dict')
    def post(self, report_name):
        tenant = request.args.get("tenant")
        data = request.get_json() or {}

        update_fields = {}

        valid_keys = ['userId', 'reportName', 'reportBody']

        for key, value in data.items():
            if key in valid_keys:
                update_fields[camel_to_snake(key)] = value

        if not update_fields:
            return create_response(
                f"the update fields is empty. valid keys are {valid_keys}",
                success=False
            ), Status.HTTP_400_BAD_REQUEST

        report_model = ReportTemplateModel(tenant)

        update_result = report_model.update_one(filter_cond={'report_name': report_name}, update_fields=update_fields)

        if update_result.modified_count > 0 or update_result.matched_count > 0:
            return create_response("report updated successfully"), Status.HTTP_202_ACCEPTED

        return create_response("report not found", success=False), Status.HTTP_404_NOT_FOUND

    @swag_from('/api/docs/report/monthly_report_extra_delete.yml')
    def delete(self, report_name):
        tenant = request.args.get("tenant")

        report_model = ReportTemplateModel(tenant)

        delete_result = report_model.delete_one({"report_name": report_name})

        if delete_result.deleted_count > 0:
            return create_response(f"monthly report {report_name} deleted successfully"), Status.HTTP_200_OK

        return create_response("report not found", success=False), Status.HTTP_404_NOT_FOUND
