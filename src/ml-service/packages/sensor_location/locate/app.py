from flask import Flask, jsonify, request
from flask_pymongo import PyMongo
from modules import locate_model, locate_helper 
#from flask_cors import CORS, crossorigin
 
app = Flask(__name__)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
app.config["MONGO_URI"] = "mongodb://localhost:27017/geocensus_db"
mongo = PyMongo(app)

@app.route('/', methods=['GET', 'POST'])
def main():
    return 'ok'

@app.route('/api/v1/parishes', methods=['GET', 'POST'])
#@crossorigin
def place_sensors():
    '''
    returns recommended parishes based on user input
    '''
    district = 'WAKISO'
    subcounty = None
    sensor_number = None
    
    all_parishes = locate_model.get_parishes(district, subcounty)
    if len(all_parishes)<2:
        return 'Invalid input data'
    else:
        all_parishes_df = locate_helper.json_to_df(all_parishes)
        all_parishes_df = locate_helper.process_data(all_parishes_df)
        recommended_parishes = locate_helper.kmeans_algorithm(all_parishes_df, sensor_number)
        return jsonify(recommended_parishes)

@app.route('/api/v1/map/parishes', methods = ['GET', 'POST'])
#@crossorigin
def place_sensors_map():
    '''
    Returns parishes recommended by the model given the geographical polygon
    '''
    if request.method == 'POST':
        json_data = request.get_json()
        if not json_data:
           return {'message': 'No input data provided'}, 400
        else:
            sensor_number = json_data["sensor_number"]
            polygon = json_data["polygon"]
            #polygon = [[[ 32.506, 0.314], [32.577, 0.389], [32.609, 0.392], [32.641, 0.362], [32.582, 0.266], [32.506, 0.314]]]
            if polygon==None:
                return jsonify({'response': 'Please draw a polygon'}), 200

            all_parishes = locate_model.get_parishes_map(polygon)
            if len(all_parishes)<2:
                return jsonify({'response': 'Invalid polygon'}), 200
            else:
                all_parishes_df = locate_helper.json_to_df(all_parishes)
                all_parishes_df = locate_helper.process_data(all_parishes_df)
                recommended_parishes = locate_helper.kmeans_algorithm(all_parishes_df, sensor_number)
                return jsonify(recommended_parishes)
    
if __name__ == "__main__":
   app.run()