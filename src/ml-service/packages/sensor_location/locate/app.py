from flask import Flask, jsonify, request
from flask_pymongo import PyMongo
from modules import locate_model, locate_helper
from flask_cors import CORS, cross_origin
import os

app = Flask(__name__)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
app.config["MONGO_URI"] = os.getenv('MONGO_URI')
mongo = PyMongo(app)

# data formate
JSON_MIME_TYPE = 'application/json'


@app.route('/', methods=['GET', 'POST'])
@cross_origin()
def main():
    return 'ok'


@app.route('/api/v1/parishes', methods=['GET', 'POST'])
@cross_origin()
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


@app.route('/api/v1/map/parishes', methods=['GET', 'POST'])
@cross_origin()
def place_sensors_map():
    '''
    Returns parishes recommended by the model given the polygon
    '''
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
            return {'message': 'No input data provided'}, 400
        else:
            sensor_number = json_data["sensor_number"]
            #sensor_number = 5
            polygon = json_data["polygon"]
            #polygon = [[[ 32.506, 0.314], [32.577, 0.389], [32.609, 0.392], [32.641, 0.362], [32.582, 0.266], [32.506, 0.314]]]
            if polygon == None:
                return jsonify({'response': 'Please draw a polygon'}), 200

            all_parishes = locate_model.get_parishes_map(polygon)
            if len(all_parishes) < 2:
                return jsonify({'response': 'Invalid polygon'}), 200
            else:
                all_parishes_df = locate_helper.json_to_df(all_parishes)
                all_parishes_df = locate_helper.process_data(all_parishes_df)
                recommended_parishes = locate_helper.kmeans_algorithm(
                    all_parishes_df, sensor_number)
                return jsonify(recommended_parishes)


# Endpoints for saving placing space
@app.route('/api/v1/map/savelocatemap', methods=['GET', 'POST'])
@cross_origin()
def save_locate_map():
    if request.content_type != JSON_MIME_TYPE:
        error = json.dumps({'error': 'Invalid Content Type'})
        return jsonify(error, 400)

    data = request.json
    if not all([data.get('user_id'), data.get('space_name'), data.get('plan')]):
        error = json.dumps({'error': 'Missing field/s (title, author_id)'})
        return jsonify(error, 400)

    user_id = data['user_id']
    space_name = data['space_name']
    plan = data['plan']

    mongo.db.locatemap.insert({
        "user_id": user_id,
        "space_name": space_name,
        "plan": plan
    })
    return jsonify({"message": "Locate Plannig Space Saved Successfully", "status": 200})

# get saved locate space by the current user
@app.route('/api/v1/map/getlocatemap/<user_id>')
@cross_origin()
def get_locate_map(user_id):
    documents = mongo.db.locatemap.find({'user_id': user_id})
    response = []
    for document in documents:
        document['_id'] = str(document['_id'])
        response.append(document)
    #response.headers['Access-Control-Allow-Origin'] = '*'
    data = jsonify(response)
    return data


if __name__ == "__main__":
    app.run()
