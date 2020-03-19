from flask import Flask
from methods import random
import controllers 
from flask_pymongo import PyMongo
import os
from pymongo import MongoClient
 
app = Flask(__name__)

# add mongo url to flask config, so that flask_pymongo can use it to make connection
app.config["MONGO_URI"] = "mongodb://localhost:27017/airqo_ml_db"
mongo = PyMongo(app)

@app.route('/', methods=['GET', 'POST'])
def main():
    return place_sensors()

@app.route('/parishes', methods=['GET', 'POST'])
def place_sensors():
    #district = 'kampala'
    #subcounty = 'nakawa'
    #sensor_number = 30

    data = controllers.mongo2df('airqo_ml_db', 'geocensus')    
    data = controllers.process_data(data)
    parishes = random(data, 20)
    return parishes

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