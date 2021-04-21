from flask import Blueprint, request, jsonify
import logging
from models import report

_logger = logging.getLogger(__name__)

report_bp = Blueprint('report', __name__)


@report_bp.route('/api/v1/analytics/report/save_default_report_template', methods=['POST'])
def save_default_report_template():
    '''
    Save default report template
    '''
    model = report.Report()
    # make sure content type is of type 'json'
    if request.content_type != 'application/json':
        return jsonify({"message": "Invalid Content Type", "success": False}), 400

    # check that all fields are supplied
    data = request.json
    if not all([data.get('user_id'), data.get('report_name'), data.get('report_body')]):
        return jsonify({"message": "Missing field/s (user_id, report_name or report_body)", "success": False}), 400

    # make sure user_id is of type string
    if type(data.get('user_id')) is not str:
        return jsonify({"message": "Invalid user_id. string required!", "success": False}), 400

    # if all checks have passed, save planning space
    user_id = data['user_id']
    report_name = data['report_name']
    report_body = data['report_body']

    model.save_default_report_template(user_id, report_name, report_body)

    return jsonify({"message": "Default Report Template Saved Successfully", "success": True}), 200

# get previously saved planning space by the current user
@report_bp.route('/api/v1/analytics/report/get_default_report_template', methods=['GET'])
def get_default_report_template():
    '''
    Get default report template
    '''
    model = report.Report()
    if request.method == 'GET':
        documents = model.get_default_report_template()
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

# save report
@report_bp.route('/api/v1/analytics/report/save_monthly_report', methods=['POST'])
def save_monthly_report():
    '''
    Save monthly report
    '''
    model = report.Report()
    if request.method == 'POST':
        # make sure content type is of type 'json'
        if request.content_type != 'application/json':
            return jsonify({"message": "Invalid Content Type", "success": False}), 400

        # check that all fields are supplied
        data = request.json
        if not all([data.get('user_id'), data.get('report_name'), data.get('report_body')]):
            return jsonify({"message": "Missing field/s (user_id, report_name or report_body)", "success": False}), 400

        # make sure user_id is of type string
        if type(data.get('user_id')) is not str:
            return jsonify({"message": "Invalid user_id. string required!", "success": False}), 400

        # if all checks have passed, save planning space
        user_id = data['user_id']
        report_name = data['report_name']
        report_body = data['report_body']

        model.save_monthly_report(user_id, report_name, report_body)

        return jsonify({"message": "Monthly Report Saved Successfully", "success": True}), 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

# get previously saved planning space by the current user
@report_bp.route('/api/v1/analytics/report/get_monthly_report/<user_id>', methods=['GET'])
def get_monthly_report(user_id):
    '''
    Get monthly report
    '''
    model = report.Report()
    if request.method == 'GET':
        documents = model.get_monthly_report(user_id)
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        data = jsonify(response)
        # data is empty
        if data == []:
            return jsonify({"message": "request return empty set. please verify request parameter(s)", "success": True, "data": data}), 200

        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


# Update default report template
@report_bp.route('/api/v1/analytics/report/update_default_report_template', methods=['POST'])
def update_default_report_template():
    '''
    updates default reporting template
    '''
    model = report.Report()
    try:
        # Get the value which needs to be updated
        try:
            json_data = request.get_json()
            update_report = json_data.get('report_body')
        except:
            # Bad request as the request body is not available
            return jsonify({"message": "bad request, request body required.", "success": False}), 400

        # Updating the planning space
        records_updated = model.update_default_report_template(
            update_report)

        # Check if resource is updated
        if records_updated.modified_count > 0:
            # Prepare the response as resource is updated successfully
            return jsonify({"message": "default reporting template updated successfully", "success": True}), 200
        else:
            # Bad request as the resource is not available to update
            return jsonify({"message": "default reporting template not updated. please make sure the report name and/or request body is correct", "success": False}), 404
    except:
        # Error while trying to update the resource
        return jsonify({"message": "error occured while trying to update reporting template", "success": False}), 500


# Update previously saved planning space
@report_bp.route('/api/v1/analytics/report/update_monthly_report/<report_name>', methods=['POST'])
def update_monthly_report(report_name):
    '''
    updates a previously saved report
    '''
    model = report.Report()
    try:
        # Get the value which needs to be updated
        try:
            json_data = request.get_json()
            update_report = json_data.get('report_body')
        except:
            # Bad request as the request body is not available
            return jsonify({"message": "bad request! request body required.", "success": False}), 400

        # Updating the planning space
        records_updated = model.update_monthly_report(
            report_name, update_report)

        # Check if resource is updated
        if records_updated.modified_count > 0:
            # Prepare the response as resource is updated successfully
            return jsonify({"message": "monthly report '" + report_name + "' updated successfully", "success": True}), 200
        else:
            # Bad request as the resource is not available to update
            return jsonify({"message": "monthly report not updated. please make sure the report name and/or request body is correct", "success": False}), 404
    except:
        # Error while trying to update the resource
        return jsonify({"message": "error occured while trying to update report", "success": False}), 500

# Delete previously saved planning space
@report_bp.route('/api/v1/analytics/report/delete_monthly_report/<report_name>', methods=['DELETE'])
def delete_monthly_report(report_name):
    '''
    deletes a previously saved report
    @param: report_name
    @return: response
    '''
    model = report.Report()
    if request.method == 'DELETE':
        if report_name is not None:
            db_response = model.delete_monthly_report(report_name)
            if db_response.deleted_count == 1:
                response = {
                    "message": "monthly report '" + report_name + "' deleted successfully", "success": True}
            else:
                response = {
                    "message": "monthly report not found. Please enter a correct report name", "Success": False}
            return jsonify(response), 200
        else:
            return jsonify({"message": "Bad request parameters!", "success": False}), 400
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400