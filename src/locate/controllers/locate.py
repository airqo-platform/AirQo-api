from flask import Blueprint, request, jsonify
from helpers import helper
import sys, ast, json
from models.parishes import Parish
from models.map import Map
from routes import api
from flask_caching import Cache

locate_blueprint = Blueprint('locate_blueprint', __name__)
cache = Cache(config={'CACHE_TYPE':'simple'})

locate_map = Map()


@locate_blueprint.route(api.route['root'])
@cache.cached(timeout=300)
def index():
    return 'OK'


@locate_blueprint.route(api.route['parishes'], methods=['POST'])
@cache.cached(timeout=300)
def place_sensors_map():
    '''
    Returns parishes recommended by the model given the polygon and must-have coordinates
    '''
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            sensor_number = int(json_data["sensor_number"])

            polygon = json_data["polygon"]
            if polygon == {}:
                return {'message': 'Please draw a polygon'}, 200
            geometry = polygon["geometry"]["coordinates"]

            must_have_coordinates = json_data["must_have_coordinates"]
            if must_have_coordinates == "":
                must_have_coordinates = None
                return helper.recommend_locations(sensor_number, must_have_coordinates, geometry)
            else:
                try:
                    must_have_coordinates = ast.literal_eval(must_have_coordinates)
                except:
                    print('EXCEPTION')
                    return {'message': 'Coordinates must be in the form [[long, lat], [long, lat]]'}, 200
                if all(isinstance(x, list) for x in must_have_coordinates):
                    return helper.recommend_locations(sensor_number, must_have_coordinates, geometry)
                else:
                    return {'message': 'Coordinates must be in the form [[longitude, latitude]]'}, 200


@locate_blueprint.route(api.route['save_map'], methods=['GET', 'POST'])
@cache.cached(timeout=300)
def save_locate_map():
    '''
    Saves planning space
    '''
    # make sure content type is of type 'json'
    if request.content_type != 'application/json':
        error = json.dumps(
            {"message": "Invalid Content Type", "success": False})
        return jsonify(error, 400)

    # check that all fields are supplied
    data = request.json
    if not all([data.get('user_id'), data.get('space_name'), data.get('plan')]):
        error = json.dumps(
            {"message": "Missing field/s (user_id, space_name or plan)", "success": False})
        return jsonify(error, 400)

    # make user_id is of type string
    if type(data.get('user_id')) is not str:
        error = json.dumps(
            {"message": "Invalid user_id. string required!", "success": False})
        return jsonify(error, 400)

    # if all checks have passed, save planning space
    user_id = data['user_id']
    space_name = data['space_name']
    plan = data['plan']

    locate_map.save_locate_map(user_id, space_name, plan)

    return jsonify({"message": "Locate Planning Space Saved Successfully", "success": True}), 200


@locate_blueprint.route(api.route['get_map'])
@cache.cached(timeout=300)
def get_locate_map(user_id):
    '''
    Get saved planning space for the user
    '''
    documents = locate_map.get_locate_map(user_id)
    response = []
    for document in documents:
        document['_id'] = str(document['_id'])
        response.append(document)
    data = jsonify(response)
    return data


@locate_blueprint.route(api.route['update_map'], methods=['GET', 'POST'])
@cache.cached(timeout=300)
def update_locate_map(space_name):
    '''
    updates a previously saved planning space
    @param: space_name
    @return: message: <MESSAGE> , status: <BOOLEAN>
    '''

    try:
        # Get the value which needs to be updated
        try:
            json_data = request.get_json()
            update_plan = json_data.get('plan')
        except:
            # Bad request as the request body is not available
            return jsonify({"message": "bad request! request body required.", "success": False}), 400

        # Updating the planning space
        records_updated = locate_map.update_locate_map(
            space_name, update_plan)

        # Check if resource is updated
        if records_updated.modified_count > 0:
            # Prepare the response as resource is updated successfully
            return jsonify({"message": "planning space '" + space_name + "' updated successfully", "success": True}), 200
        else:
            # Bad request as the resource is not available to update
            return jsonify({"message": "planning not updated. please make sure the plan name / request body is correct", "success": False}), 404
    except:
        # Error while trying to update the resource
        return jsonify({"message": "error occured while trying to update planning space", "success": False}), 500

@locate_blueprint.route(api.route['delete_map'], methods=['DELETE'])
@cache.cached(timeout=300)
def delete_locate_map(space_name):
    '''
    deletes a previously saved planning space
    @param: space_name
    @return: null
    '''
    if request.method == 'DELETE':
        if space_name is not None:
            db_response = locate_map.delete_locate_map(space_name)
            if db_response.deleted_count == 1:
                response = {
                    "message": "planning space deleted successfully", "success": True}
            else:
                response = {
                    "message": "planning space name not found. Please enter a correct planning space name", "Success": False}
            return jsonify(response), 200
        else:
            return jsonify({"message": "Bad request parameters!", "success": False}), 400
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400