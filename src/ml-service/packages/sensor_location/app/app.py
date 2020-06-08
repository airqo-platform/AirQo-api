from flask import Flask
from flask_pymongo import PyMongo
from modules import locate_model, locate_helper 
 
app = Flask(__name__)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
app.config["MONGO_URI"] = "mongodb://localhost:27017/geocensus_db"
mongo = PyMongo(app)

@app.route('/', methods=['GET', 'POST'])
def main():
    return place_sensors()

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
    #retrieve latitude and longitude coordinates
    #convert them to points e.g. my_point = Point(32.6, 0.325) and append them to list
    #for each point, check which parish it lies e.g. if point.within(polygon)
    #create a dict with parishes as keys and points as values
    #retrieve data for those parishes from the database and run the model on them
    #return coordinates that are related to those parishes in the dict.
    return 'placeholder'
    
if __name__ == "__main__":
   app.run()