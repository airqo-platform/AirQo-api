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
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            loc_ref = json_data["locationReference"]
            #print(loc_ref, file=sys.stderr)
            host_name = json_data["hostName"]
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
            country = "Uganda"
            print(country, file=sys.stderr)
            region, district, county, subcounty, parish = helper.get_location_details(longitude, latitude)
            location_name = helper.get_location_name(parish.capitalize(), district.capitalize())
            altitude = helper.get_altitude(latitude,longitude)
            landform_90 = helper.get_landform90(latitude, longitude)
            landform_270 = helper.get_landform270(latitude, longitude)
            aspect = None
            closest_road_type, closest_distance, closest_residential_distance= helper.distance_to_closest_road(latitude, longitude)
            print(latitude,file=sys.stderr)
            print(longitude, file=sys.stderr)
            print(closest_road_type, file=sys.stderr)
            print(closest_distance, file=sys.stderr)
            print(closest_residential_distance, file=sys.stderr)
            closest_motorway_distance = helper.distance_to_closest_motorway(latitude, longitude)
            print(closest_motorway_distance, file=sys.stderr)
            nearest_city_distance = helper.distance_to_nearest_city(latitude, longitude)
            print(nearest_city_distance, file=sys.stderr)
            try:
                helper.register_location(loc_ref, host_name, mobility, longitude, latitude, internet, power, height, road_intensity, 
                installation_type, road_status, landuse, location_name, country, region, district, county, subcounty, parish, altitude, 
                aspect, landform_90, landform_270, closest_distance, closest_motorway_distance, closest_residential_distance, 
                nearest_city_distance)
                return {'message': 'Location registered succesfully'}, 200
            except:
                return {'message': 'An error occured. Please input valid data'}, 400

@location_blueprint.route('/api/v1/location_registry/locations', methods =['GET'])
def get_all_locations():
    '''
    Gets data for all the locations in the database
    '''
    return jsonify(helper.all_locations())



