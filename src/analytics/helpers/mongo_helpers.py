from helpers import helpers 
from pymongo import MongoClient
from app import mongo, MONGO_URI
from datetime import datetime
import os


MONGO_URI =  os.getenv("MONGO_URI")

def save_device_daily_historical_averages(data):
    """
    """
    for i  in data:
        mongo.db.device_daily_historical_averages.insert(i)

def get_last_time_from_device_hourly_measurements(device_code):
        """ Gets the time of the latest record inserted in hourly device measurements.

        Args:
            device_code: the code used to identify the device.

        Returns:
            time for the last record inserted.

        """           
        query = {'deviceCode': device_code}
        last_record = list(mongo.db.device_hourly_measurements.find(query).sort([('time', -1)]).limit(1))
        last_time = last_record[0]['time']
        return last_time

def get_last_time_from_device_daily_measurements(device_code):
        """ Gets the time of the latest record inserted in daily device measurements.

        Args:
            device_code: the code used to identify the device.

        Returns:
            time for the last record inserted.

        """           
        query = {'deviceCode': device_code}
        last_record = list(mongo.db.device_daily_measurements.find(query).sort([('time', -1)]).limit(1))
        last_time = last_record[0]['time']
        return last_time

def update_hourly_measurements(data):
    """
     inserts new hourly measurements if they don't exist in db.
    """
    for i  in data:
        key = {'_id': i['_id']}        
        mongo.db.device_hourly_measurements.update(key,i, upsert=True)

def update_daily_measurements(data):
    """
     inserts new daily measurements if they don't exist in db.
    """
    for i  in data:
        key = {'_id': i['_id']}        
        mongo.db.device_daily_measurements.update(key,i, upsert=True)

def save_hourly_measurements(data):
    """
    Saves hourly measurements.
    """
    for i  in data:
        mongo.db.device_hourly_measurements.insert(i)
        

def save_daily_measurements(data):
    """
     Inserts daily measurements into device_daily_measurements collection.
    """
    for i  in data:
        mongo.db.device_daily_measurements.insert(i)

def insert_data_mongo(data):
    """
    Inserts raw clarity data into MongoDB
    """
    client = MongoClient(MONGO_URI)
    db=client['airqo_analytics']
    for i in data:
        db['device_raw_measurements'].insert_one(i)

def get_last_time(device_code):
    """
    Gets the time of the latest record in the MongoDB
    """
    client = MongoClient(MONGO_URI)  
    db=client['airqo_analytics']
    
    query = {'deviceCode': device_code}
    last_record = list(db.device_raw_measurements.find(query).sort([('time', -1)]).limit(1))
    last_time = last_record[0]['time']
    return last_time

def get_filtered_data(device_code, start_date = None, end_date=None, frequency = 'daily', pollutant = 'PM 2.5'):
        """
        returns the data of a certain device with specified parameters
        """
        if start_date == None:
            start = helpers.str_to_date_find('2019-06-01T00:00:00Z')
        else:
            start = helpers.str_to_date(start_date)
        if end_date == None:
            end = datetime.now()
        else:
            end = helpers.str_to_date(end_date)

        query = { 'deviceCode': device_code, 'time': {'$lte': end, '$gte': start} }
                                 
        if pollutant == 'PM 10':
            projection = { '_id': 0, 'time': 1, 'characteristics.pm10ConcMass.value':1 }
        elif pollutant == 'NO2':
            projection = { '_id': 0, 'time': 1, 'characteristics.no2Conc.value':1 }        
        else:
            projection = { '_id': 0, 'time': 1, 'characteristics.pm2_5ConcMass.value':1 }
                                 
        #client = MongoClient(MONGO_URI)  
        #db=client['airqo_analytics']
                                 
        if frequency =='hourly':
            records = mongo.db.device_hourly_measurements.find(query, projection)
        else:
            records = mongo.db.device_daily_measurements.find(query, projection)
    
        return list(records)