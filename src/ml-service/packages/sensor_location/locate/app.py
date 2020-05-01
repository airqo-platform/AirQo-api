from flask import Flask, jsonify, request
from flask_pymongo import PyMongo
from modules import locate_model, locate_helper
#from flask_cors import CORS, crossorigin
from flask_cors import CORS
import os
import sys
import ast
import json

app = Flask(__name__)
CORS(app)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
app.config["MONGO_URI"] = os.getenv('MONGO_URI')
mongo = PyMongo(app)

# data formate
JSON_MIME_TYPE = 'application/json'


@app.route('/', methods=['GET', 'POST'])
def main():
    return 'ok'


@app.route('/api/v1/parishes', methods=['GET', 'POST'])
def place_sensors():
    '''
    returns recommended parishes based on user input (district/subcounty)
    '''
    district = 'WAKISO'
    subcounty = None
    sensor_number = None

    all_parishes = locate_model.get_parishes(district, subcounty)
    if len(all_parishes) < 2:
        return 'Invalid input data'
    else:
        all_parishes_df = locate_helper.json_to_df(all_parishes)
        all_parishes_df = locate_helper.process_data(all_parishes_df)
        recommended_parishes = locate_helper.kmeans_algorithm(
            all_parishes_df, sensor_number)
        return jsonify(recommended_parishes)


@app.route('/api/v1/map/parishes', methods=['POST'])
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
                return locate_helper.recommend_locations(sensor_number, must_have_coordinates, geometry)
            else:
                try:
                    must_have_coordinates = ast.literal_eval(
                        must_have_coordinates)
                except:
                    return {'message': 'Coordinates must be in the form [[long, lat], [long, lat]]'}, 200
                if all(isinstance(x, list) for x in must_have_coordinates):
                    return locate_helper.recommend_locations(sensor_number, must_have_coordinates, geometry)
                else:
                    return {'message': 'Coordinates must be in the form [[longitude, latitude]]'}, 200


@app.route('/api/v1/map/savelocatemap', methods=['GET', 'POST'])
def save_locate_map():
    '''
    Saves planning space
    '''
    if request.content_type != 'application/json':
        error = json.dumps({'error': 'Invalid Content Type'})
        return jsonify(error, 400)

    data = request.json
    if not all([data.get('user_id'), data.get('space_name'), data.get('plan')]):
        error = json.dumps({'error': 'Missing field/s (title, author_id)'})
        return jsonify(error, 400)

    user_id = data['user_id']
    space_name = data['space_name']
    plan = data['plan']

    locate_model.save_locate_map(user_id, space_name, plan)

    return jsonify({"message": "Locate Plannig Space Saved Successfully", "status": 200})

# get previously saved planning space by the current user
@app.route('/api/v1/map/getlocatemap/<user_id>')
def get_locate_map(user_id):
    '''
    Get saved planning space for the user
    '''
    documents = locate_model.get_locate_map(user_id)
    response = []
    for document in documents:
        document['_id'] = str(document['_id'])
        response.append(document)
    data = jsonify(response)
    return data

# Update previously saved planning space
@app.route('/api/v1/map/updatelocatemap/<space_name>', methods=['GET', 'POST'])
def update_locate_map(space_name):
    '''
    updates a previously saved planning space

    @param: space_name
    @return: null

    '''
    pass

# Delete previously saved planning space
@app.route('/api/v1/map/deletelocatemap/<space_name>', methods=['GET', 'POST', 'DELETE', 'PUT'])
def delete_locate_map(space_name):
    '''
    deletes a previously saved planning space
    @param: space_name
    @return: null
    '''
    if request.method == 'DELETE':
        if space_name is not None:
            db_response = locate_model.delete_locate_map(space_name)
            if db_response.deleted_count == 1:
                response = {'ok': True,
                            'message': 'planning space deleted successfully'}
            else:
                response = {'ok': True, 'message': 'no record found'}
            return jsonify(response), 200
        else:
            return jsonify({'ok': False, 'message': 'Bad request parameters!'}), 400
    else:
        return jsonify({'ok': False, 'message': 'Invalid request method'}), 400


if __name__ == "__main__":
    app.run()
