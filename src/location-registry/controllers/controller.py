from flask import Blueprint
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
            host = json_data["hostName"]
            #print("hostName",hostName, file=sys.stderr)
            mobility = json_data["mobility"]
            #print("mobilty",mobility, file=sys.stderr)
            latitude = json_data["latitude"]
            #print("latitude",latitude, file=sys.stderr)
            longitude = json_data["longitude"]
            #print("longitude",longitude, file=sys.stderr)
            internet = json_data["internet"]
            #print("internet",internet, file=sys.stderr)
            power = json_data["power"]
            #print("power",power, file=sys.stderr)
            height = json_data["height"]
            #print("height",height, file=sys.stderr)
            road_intensity = json_data["roadIntensity"]
            #print("road_intensity",road_intensity, file=sys.stderr)
            installation_type = json_data["installationType"]
            #print("installation_type",installation_type, file=sys.stderr)
            road_status = json_data["road_status"]
            #print("road_status",road_status, file=sys.stderr)
            landuse = json_data["landuse"]
            #print("landuse",landuse, file=sys.stderr)
    return 'ok'

