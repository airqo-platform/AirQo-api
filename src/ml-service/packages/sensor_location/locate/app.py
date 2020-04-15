from flask import Flask
from flask_pymongo import PyMongo
from modules import locate_model, locate_helper 
 
app = Flask(__name__)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
app.config["MONGO_URI"] = "mongodb://localhost:27017/geocensus_db"
mongo = PyMongo(app)

@app.route('/', methods=['GET', 'POST'])
def main():
    return 'ok'

@app.route('/parishes', methods=['GET', 'POST'])
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
        return recommended_parishes

@app.route('/map', methods = ['GET', 'POST'])
def place_sensors_map():
    polygon = [[[ 32.506, 0.314], [32.577, 0.389], [32.609, 0.392], [32.641, 0.362], [32.582, 0.266], 
                      [32.506, 0.314]]]
    sensor_number = 20
    
    all_parishes = locate_model.get_parishes_map(polygon)
    if len(all_parishes)<2:
        return 'Invalid input data'
    else:
        all_parishes_df = locate_helper.json_to_df(all_parishes)
        all_parishes_df = locate_helper.process_data(all_parishes_df)
        recommended_parishes = locate_helper.kmeans_algorithm(all_parishes_df, sensor_number)
        return recommended_parishes
    
if __name__ == "__main__":
   app.run()