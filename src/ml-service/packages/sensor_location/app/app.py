from flask import Flask, render_template
import pandas as pd
from models import random
import controllers 
from flask_pymongo import PyMongo
import os
from pymongo import MongoClient
 
app = Flask(__name__)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
#app.config['MONGO_URI'] = os.environ.get('DB')
app.config["MONGO_URI"] = "mongodb://localhost:27017/geocensus_db"
mongo = PyMongo(app)

@app.route('/', methods=['GET', 'POST'])
def main():
    #return 'Boston House Price'
    return place_sensors()

@app.route('/kampala', methods=['GET', 'POST'])
def place_sensors():
    #district = 'kampala'
    #subcounty = 'nakawa'
    #sensor_number = 30

    #data = controllers.mongo2df('geocensus_db', 'kampala')
    filepath = r'C:\Users\User\AirQo\Lilly\sensor-location-model\geo_census.csv'
    data = pd.read_csv(filepath)
    #data = pd.read_csv('geo_Census.csv')
    
    data = controllers.process_data(data)
    parishes = random(data, 20)
    return parishes

@app.route('/map', methods = ['GET', 'POST'])
def place_sensors_map():
    #retrieve latitude and longitude coordinates
    #convert them to points e.g. my_point = Point(32.6, 0.325) and append them to list
    #for each point, check which parish it lies e.g. if point.within(polygon)
    #create a dict with parishes as keys and points as values
    # retrieve data for those parishes from the database and run the model on them
    # return coordinates that are related to those parishes in the dict.
    return 'placeholder'
    
 
if __name__ == "__main__":
   app.run()