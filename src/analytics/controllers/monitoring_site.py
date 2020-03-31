from flask import Blueprint, request, jsonify
import logging
import app
from models import monitoring_site
from bson import json_util, ObjectId
import json
import numpy as np
from helpers import mongo_helpers

_logger = logging.getLogger(__name__)

monitoring_site_bp = Blueprint('monitoring_site', __name__)


@monitoring_site_bp.route('/api/v1/monitoringsites/', methods=['GET'])
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


@monitoring_site_bp.route('/api/v1/monitoringsite/historical/daily', methods=['GET'])
def get_device_past_28_days_measurements():
    ms = monitoring_site.MonitoringSite()
    if request.method == 'GET':
        device_code= request.args.get('device_code')
        if device_code:
            historical_results =[]
            records = [] 
            pm25_daily_values = []          
            monitoring_site_measurements_cursor = ms.get_device_past_28_days_measurements(device_code)
            for site in monitoring_site_measurements_cursor:
                record = {'pm2_5_value':site["characteristics"]['pm2_5ConcMass']['value'], 'time':site["time"]}
                records.append(record)
                pm25_daily_values.append(site["characteristics"]['pm2_5ConcMass']['value'])
                historical_results.append(site)
            return jsonify({"historical_measurements":historical_results, "records":records, "pm25_values":pm25_daily_values})
        else:
            return jsonify({"error msg": "device code wasn't supplied in the query string parameter."})


@monitoring_site_bp.route('/api/v1/monitoringsite/historical/daily/calculate', methods =['GET'])
def calculate_average_daily_measurements_for_last_28_days():
    ms = monitoring_site.MonitoringSite()     
    devices_codes =  list(app.mongo.db.devices.find({},{"code": 1, "_id": 0}))
    average='day'
    devices_historical_records=[]
    for device_code in devices_codes:
        code= device_code['code']            
        historical_results =[]
        records = [] 
        pm25_daily_values = []
        average_pm25=0          
        monitoring_site_measurements_cursor = ms.get_device_past_28_days_measurements(code)
        for site in monitoring_site_measurements_cursor:
            record = {'pm2_5_value':site["characteristics"]['pm2_5ConcMass']['value'], 'time':site["time"]}
            records.append(record)
            pm25_daily_values.append(site["characteristics"]['pm2_5ConcMass']['value'])
            historical_results.append(site)

        if len(pm25_daily_values)>0:
            average_pm25 =np.mean(pm25_daily_values)
            historical_record = {'deviceCode':device_code, 'average_pm25': average_pm25, 'historal_records':records}
            devices_historical_records.append(historical_record)

    mongo_helpers.save_device_daily_historical_averages(devices_historical_records)
      
    return jsonify({'response': 'all new hourly measurements saved'}), 200


@monitoring_site_bp.route('/api/v1/monitoringsite/historical/daily/devices', methods=['GET'])
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


