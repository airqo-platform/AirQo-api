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
            local_activities = json_data["localActivities"]
            country = "Uganda"
            try:
                region, district, county, subcounty, parish = helper.get_location_details(longitude, latitude)
                location_name = helper.get_location_name(parish.capitalize(), district.capitalize())
            except:
                region, district, county, subcounty, parish, location_name = None, None, None, None, None, None
            try:
                altitude = helper.get_altitude(latitude,longitude)
            except:
                altitude = None
            try:
                landform_90 = helper.get_landform90(latitude, longitude)
            except:
                landform_90 = None
            try:
                landform_270, aspect  = helper.get_landform270(latitude, longitude)
            except:
                landform_270, aspect = None, None
            try:
                closest_road_type, closest_distance, closest_residential_distance= helper.distance_to_closest_road(latitude, longitude)
            except:
                closest_road_type, closest_distance, closest_residential_distance = None, None, None
            try:
                closest_motorway_distance = helper.distance_to_closest_motorway(latitude, longitude)
            except:
                closest_motorway_distance = None
            try:
                nearest_city_distance = helper.distance_to_nearest_city(latitude, longitude)
            except:
                nearest_city_distance = None, None, None
            try:
                helper.register_location(loc_ref, host_name, mobility, longitude, latitude, internet, power, height, road_intensity, 
                installation_type, road_status, local_activities, location_name, country, region, district, county, subcounty, parish, altitude, 
                aspect, landform_90, landform_270, closest_distance, closest_motorway_distance, closest_residential_distance, 
                nearest_city_distance)
                return {'message': 'Location registered succesfully'}, 200
            except:
                return {'message': 'An error occured. Please try again'}, 200

@location_blueprint.route('/api/v1/location_registry/locations', methods =['GET'])
def get_all_locations():
    '''
    Gets data for all the locations in the database
    '''
    return jsonify(helper.all_locations())

@location_blueprint.route('/api/v1/location_registry', methods =['GET'])
def get_location_details():
    '''
    Gets data for all the locations in the database
    '''
    if request.method == 'GET':
        loc_ref= request.args.get('loc_ref')
        return helper.get_location(loc_ref)

@location_blueprint.route('/api/v1/location_registry/edit', methods =['GET'])
def edit_location():
    '''
    Returns detaild of location to edit
    '''
    if request.method == 'GET':
        loc_ref = request.args.get('loc_ref')
        return jsonify(helper.get_location_details_to_edit(loc_ref))

@location_blueprint.route('/api/v1/location_registry/update', methods =['POST'])
def update_location():
    '''
    Updates an edited location's details
    '''
    if request.method == 'POST':   
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            loc_ref = json_data["locationReference"]
            power = json_data["power"]
            internet = json_data["internet"]
            height = json_data["height"]
            road_intensity = json_data["roadIntensity"]
            installation_type = json_data["installationType"]
            road_status = json_data["roadStatus"]
            local_activities = json_data["localActivities"]

            #loc_ref = json_data["locationReference"]
            #host_name = json_data["hostName"]
            #mobility = json_data["mobility"]
            #latitude = json_data["latitude"]
            #longitude = json_data["longitude"]
            #internet = json_data["internet"]
            #power = json_data["power"]
            #height = json_data["height"]
            #road_intensity = json_data["roadIntensity"]
            #installation_type = json_data["installationType"]
            #road_status = json_data["roadStatus"]
            #local_activities = json_data["localActivities"]
            #country = "Uganda"

            #try:
             #   region, district, county, subcounty, parish = helper.get_location_details(longitude, latitude)
              #  location_name = helper.get_location_name(parish.capitalize(), district.capitalize())
            #except:
             #   region, district, county, subcounty, parish, location_name = None, None, None, None, None, None
            #try:
            #    altitude = helper.get_altitude(latitude,longitude)
            #except:
             #   altitude = None
            #try:
            #    landform_90 = helper.get_landform90(latitude, longitude)
            #except:
             #   landform_90 = None
            #try:
             #   landform_270, aspect  = helper.get_landform270(latitude, longitude)
            #except:
             #   landform_270, aspect = None, None
            #try:
             #   closest_road_type, closest_distance, closest_residential_distance= helper.distance_to_closest_road(latitude, longitude)
            #except:
             #   closest_road_type, closest_distance, closest_residential_distance = None, None, None
            #try:
             #   closest_motorway_distance = helper.distance_to_closest_motorway(latitude, longitude)
            #except:
             #   closest_motorway_distance = None
            #try:
             #   nearest_city_distance = helper.distance_to_nearest_city(latitude, longitude)
            #except:
             #   nearest_city_distance = None, None, None
            try:
                helper.save_edited_location(loc_ref, power, internet, height, road_intensity, installation_type, road_status, local_activities)
                #helper.save_edited_location(loc_ref, host_name, internet, power, height, road_intensity, installation_type, road_status, 
                #local_activities, location_name, region, district, county, subcounty, parish, altitude, aspect, landform_90, 
                #landform_270, closest_distance, closest_motorway_distance, closest_residential_distance, nearest_city_distance)
                return {'message': 'Location has been successfully updated'}, 200
            except:
                return {'message': 'An error occured. Please try again'}, 200
            




