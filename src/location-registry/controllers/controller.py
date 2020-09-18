from flask import Blueprint, request, jsonify
from helpers import helper
import sys
from flask_caching import Cache
#from flask_cache import Cache
from models.location import Location
import sys

location_blueprint = Blueprint('location_blueprint', __name__)
location = Location()

# cache = Cache(config={
#     'CACHE_TYPE': 'redis',
#     'CACHE_KEY_PREFIX': 'fcache',
#     'CACHE_REDIS_HOST': '35.224.67.244:6379',
#     'CACHE_REDIS_PORT': '6379',
#     'CACHE_REDIS_URL': 'redis://35.224.67.244:6379:6379'
# })

cache = Cache(config={'CACHE_TYPE': 'simple'})


@location_blueprint.route('/')
@cache.cached(timeout=0)
def index():
    return 'OK'


@location_blueprint.route('/api/v1/location_registry/create_id', methods=['GET'])
@cache.cached(timeout=5)
def generate_ref():
    '''
    Generates a reference id for a new location
    '''
    tenant_id = request.args.get('tenant')
    return helper.get_location_ref(tenant_id)


@location_blueprint.route('/api/v1/location_registry/register', methods=['POST'])
# @cache.cached(timeout=60)
def register_location():
    '''
    Saves a new location into a database
    '''
    if request.method == 'POST':
        tenant_id = request.args.get('tenant')
    
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            loc_ref = json_data["locationReference"]
            host_name = json_data["hostName"]
            mobility = json_data["mobility"]

            if mobility == 'Mobile':
                latitude = None
                longitude = None
            else:
                try:
                    latitude = float(json_data["latitude"])
                    longitude = float(json_data["longitude"])
                except: 
                    latitude = None
                    longitude = None
            try:
                road_intensity = int(json_data["roadIntensity"])
            except:
                road_intensity = None    
            road_status = json_data["roadStatus"]
            description = json_data["description"]
            local_activities = []
            for i in json_data["localActivities"]:
                local_activities.append(i["value"])
            country = "Uganda"

            if mobility == 'Static':
                try:
                    region, district, county, subcounty, parish = helper.get_location_details(
                        longitude, latitude, 'airqo')
                    location_name = helper.get_location_name(
                        parish.capitalize(), district.capitalize())
                except:
                    region, district, county, subcounty, parish, location_name = None, None, None, None, None, None
                try:
                    altitude = helper.get_altitude(latitude, longitude)
                except:
                    altitude = None
                try:
                    landform_90 = helper.get_landform90(latitude, longitude)
                except:
                    landform_90 = None
                try:
                    landform_270, aspect = helper.get_landform270(
                        latitude, longitude)
                except:
                    landform_270, aspect = None, None
                try:
                    closest_road_type, closest_distance, closest_residential_distance = helper.distance_to_closest_road(
                        latitude, longitude)
                except:
                    closest_road_type, closest_distance, closest_residential_distance = None, None, None
                try:
                    closest_motorway_distance = helper.distance_to_closest_motorway(
                        latitude, longitude)
                except:
                    closest_motorway_distance = None
                try:
                    nearest_city_distance = helper.distance_to_nearest_city(
                        latitude, longitude)
                except:
                    #nearest_city_distance = None, None, None
                    nearest_city_ditance = None
            else:
                region, district, county, subcounty, parish, location_name = None, None, None, None, None, None
                altitude = None
                landform_90 = None
                landform_270, aspect = None, None
                closest_road_type, closest_distance, closest_residential_distance = None, None, None
                closest_motorway_distance = None
                nearest_city_distance = None
            try:
                location.register_location(tenant_id, loc_ref, host_name, mobility, longitude, latitude, road_intensity, description, road_status, 
                local_activities, location_name, country, region, district, county, subcounty, parish, altitude, aspect, landform_90, 
                landform_270, closest_distance, closest_motorway_distance, closest_residential_distance, nearest_city_distance)
                cache.clear()
                return {'message': 'Location registered succesfully'}, 200
            except:
                return {'message': 'An error occured. Please try again'}, 400
            


@location_blueprint.route('/api/v1/location_registry/locations', methods=['GET'])
@cache.cached(timeout=0)
def get_all_locations():
    '''
    Gets data for all the locations in the database
    '''
    tenant_id = request.args.get('tenant')
    return jsonify(location.all_locations(tenant_id))


@location_blueprint.route('/api/v1/location_registry/location', methods=['GET'])
@cache.cached(timeout=5)
def get_location_details():
    '''
    Gets data for a particular location
    '''
    if request.method == 'GET':
        loc_ref = request.args.get('loc_ref')
        tenant_id = request.args.get('tenant')
        try:
            details = location.get_location(tenant_id, loc_ref)
            return details
        except:
            return {'message': 'An error occured. Please enter valid location reference'}, 400


@location_blueprint.route('/api/v1/location_registry/edit', methods=['GET'])
@cache.cached(timeout=5)
def edit_location():
    '''
    Returns details of location to edit
    '''
    if request.method == 'GET':
        loc_ref = request.args.get('loc_ref')
        tenant_id = request.args.get('tenant')
        try: 
            details = location.get_location_details_to_edit(tenant_id, loc_ref)
            return jsonify(details)
        except:
            return {'message': 'An error occured. Please enter valid location reference'}, 400


@location_blueprint.route('/api/v1/location_registry/update', methods=['POST'])
# @cache.cached(timeout=60)
def update_location():
    '''
    Updates an edited location's details
    '''

    if request.method == 'POST':
        tenant_id = request.args.get('tenant')
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            loc_ref = json_data["locationReference"]
            try:
                road_intensity = int(json_data["roadIntensity"])
            except: 
                road_intensity = None
            description = json_data["description"]
            road_status = json_data["roadStatus"]
            #local_activities = json_data["localActivities"]
            local_activities = []
            for i in json_data["localActivities"]:
                local_activities.append(i["value"])

            try:
                '''location.save_edited_location(loc_ref, power, internet, height, road_intensity, installation_type, road_status,
                                              local_activities)'''
                location.save_edited_location(tenant_id, loc_ref, road_intensity, description, road_status, local_activities)
                cache.clear()
                return {'message': 'Location has been successfully updated'}, 200
            except:
                return {'message': 'An error occured. Please try again'}, 400