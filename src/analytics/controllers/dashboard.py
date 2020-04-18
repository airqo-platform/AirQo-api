from flask import Blueprint, request, jsonify
import logging
import app
from models import monitoring_site
from bson import json_util, ObjectId
import json
from helpers import mongo_helpers
from helpers import helpers 
from flask_cors import CORS, cross_origin

_logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/api/v1/dashboard/monitoringsites', methods=['GET'])
def get_organisation_monitoring_site():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        org_name= request.args.get('organisation_name')
        if org_name:
            monitoring_sites=[]
            organisation_monitoring_sites_cursor = ms.get_all_organisation_monitoring_sites(org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites.append(site)

            results = json.loads(json_util.dumps(monitoring_sites))
            return jsonify({"airquality_monitoring_sites":results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})

@dashboard_bp.route('/api/v1/dashboard/monitoringsites/locations', methods=['GET'])
def get_organisation_monitoring_site_locations():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        org_name= request.args.get('organisation_name')
        if org_name:
            monitoring_sites_locations=[]
            organisation_monitoring_sites_cursor = ms.get_monitoring_site_locations(org_name)
            for site in organisation_monitoring_sites_cursor:
                monitoring_sites_locations.append(site)
            results = json.loads(json_util.dumps(monitoring_sites_locations))
            return jsonify({"airquality_monitoring_sites":results})
        else:
            return jsonify({"error msg": "organisation name wasn't supplied in the query string parameter."})


@dashboard_bp.route('/api/v1/dashboard/historical/daily/devices', methods=['GET'])
def get_all_device_past_28_days_measurements():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        results=[]
        values =[]
        labels = []
        monitoring_site_measurements_cursor = ms.get_all_devices_past_28_days_measurements()
        for site in monitoring_site_measurements_cursor: 
            values.append(site["average_pm25"])
            labels.append(site["deviceCode"]["code"])             
            results.append(site)
        return jsonify({"results":{"average_pm25_values":values, "labels":labels}})
    else:
        return jsonify({"error msg": "invalid request."})


'''@dashboard_bp.route('/api/v1/device/graph', methods=['POST'])
@cross_origin()
def get_filtered_data():
    if request.method=='POST':
        #device_code = request.args.get('device_code')
        device_code = 'AY2J2Q7Z'
        #start_date = request.args.get('start_date')
        start_date = '2020-01-01T00:00:00Z'
        #end_date = request.args.get('end_date')
        end_date = '2020-01-02T00:00:00Z'
        frequency = request.args.get('frequency')
        #frequency = 'daily'
        #pollutant = 'PM 2.5'
        pollutant = request.args.get('pollutant')
        records = mongo_helpers.get_filtered_data(device_code, start_date, end_date, frequency, pollutant )
        if len(records)==0:
            response = jsonify({'response': 'No records'}), 200
        else:
            #return Response(json.dumps(records), mimetype='application/json')
            response = jsonify(records)
    else:
        response = jsonify({"response': 'Didn't get parameters"}), 200
    
    #response.headers.add("Access-Control-Allow-Origin", "*")
    #response.headers.add("Access-Control-Allow-Origin", "*")
    return response
    '''



@dashboard_bp.route('/api/v1/divisions', methods=['GET'])
def get_divisions():
    divisions=[]
    division_cursor =  app.mongo.db.division.find()
    for division in division_cursor:
        divisions.append(division)

    results = json.loads(json_util.dumps(divisions))
    return jsonify({"divisions":results}), 200


'''@dashboard_bp.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'
        '''
