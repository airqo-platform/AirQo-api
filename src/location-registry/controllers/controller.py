from flask import Blueprint, request, jsonify
from helpers import helper
import sys

location_blueprint = Blueprint('location_blueprint', __name__)


@location_blueprint.route('/')
def index():
    return 'OK'

@location_blueprint.route('/api/v1/location_registry/create_id', methods = ['GET'])
def generate_ref():
    '''
    Generates a reference id for a new location
    '''
    return helper.get_location_ref()
    #return 'ok'  
    

@location_blueprint.route('/api/v1/location_registry/register', methods =['POST'])
def register_location():
    '''
    Saves a new location into a database
    '''
    if request.method == 'POST':   
        print ("It's a POST Request!")
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            loc_ref = json_data["locationReference"]
            #print(loc_ref, file=sys.stderr)
            hostName = json_data["hostName"]
            mobility = json_data["mobility"]
            latitude = json_data["latitude"]
            longitude = json_data["longitude"]
            internet = json_data["internet"]
            power = json_data["power"]
            height = json_data["height"]
            road_intensity = json_data["roadIntensity"]
            installation_type = json_data["installationType"]
            road_status = json_data["roadStatus"]
            landuse = json_data["landuse"]
    return 'ok'

