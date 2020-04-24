from flask import Blueprint, request, jsonify, Response
import logging
import datetime as dt
from app import mongo
from helpers.clarity_api import ClarityApi
from bson import json_util, ObjectId
import json
import sys
from datetime import datetime,timedelta
from helpers import mongo_helpers
from helpers import helpers 
from flask_cors import CORS, cross_origin

_logger = logging.getLogger(__name__)

graph_bp = Blueprint('graph', __name__)

@graph_bp.route('/api/v1/device/graph', methods=['GET','POST'])
@cross_origin()
def get_filtered_data():
    if request.method=='POST':
        json_data = request.get_json()
        if not json_data:
            print ('JSON DATA IS EMPTY:', file=sys.stderr)
            return jsonify({'response': 'No input data found'}), 200
        else:
            #device_code =json_data["location"]
            device_code = "ALS2LCWY"
            #device_code = json_data["deviceCode"]
            print('device code:',device_code, file=sys.stderr)
            start_date =json_data["startDate"]
            print('start date:',start_date, file=sys.stderr)
            end_date =json_data["endDate"]
            print(end_date, file=sys.stderr)
            chart_type =json_data["chartType"]
            print('chart type:',chart_type, file=sys.stderr)
            frequency =json_data["frequency"]
            print(frequency, file=sys.stderr)
            pollutant =json_data["pollutant"]
            print(pollutant, file=sys.stderr)

            if chart_type==None:
                chart_type='bar'
            if chart_type=='bar' or chart_type =='line':
                records = mongo_helpers.get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
            else:
                records = mongo_helpers.get_piechart_data(device_code, start_date, end_date, frequency, pollutant)
            return jsonify(records)
       
        #else:
         #   records = mongo_helpers.get_filtered_data(device_code, start, end, frequency, pollutant )
          #  print('bar graph coming through', file=sys.stderr)
        #if len(records)==0:
         #   return jsonify({'response': 'No records'}), 200
        #else:
            #return Response(json.dumps(records), mimetype='application/json')
         #   return jsonify(records)
    else:
        return jsonify({'response': 'No request made'}), 200
    
    #response.headers.add("Access-Control-Allow-Origin", "*")
    #response.headers.add("Access-Control-Allow-Origin", "*")
