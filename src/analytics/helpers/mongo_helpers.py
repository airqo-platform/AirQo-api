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

def get_filtered_data(device_code, start_date = None, end_date=None, frequency = 'daily', pollutant = 'pm2_5'):
        """
        returns the data of a certain device with specified parameters
        """
        if start_date == None:
            start = helpers.str_to_date_find('2019-06-01T00:00:00Z')
        else:
            start = helpers.str_to_date_find(start_date)
        if end_date == None:
            end = datetime.now()
        else:
            end = helpers.str_to_date_find(end_date)
        
        query = { 'deviceCode': device_code, 'time': {'$lte': end, '$gte': start} }
                                 
        if pollutant == 'pm10':
            projection = { '_id': 0, 'time': 1, 'characteristics.pm10ConcMass.value':1 }
        else:
            projection = { '_id': 0, 'time': 1, 'characteristics.pm2_5ConcMass.value':1 }
                                 
        #client = MongoClient(MONGO_URI)
        #client = MongoClient("mongodb+srv://lillian:fosho@cluster0-99jha.gcp.mongodb.net/test?retryWrites=true&w=majority")  
        #db=client['airqo_analytics']
        

        client = MongoClient("mongodb://localhost:27017/")  
        db=client['kcca_db']
        
        records = db.clarity_data.find(query, projection)
        #records = db.device_raw_measurements.find(query, projection)
                                 
        #if frequency =='hourly':
            #records = db.device_hourly_measurements.find(query, projection)
            #records = db.clarity_data.find(query, projection)
    
        #else:
            #records = db.device_daily_measurements.find(query, projection)
            #records = db.clarity_data.find(query, projection)
    
        return list(records)

def get_piechart_data(device_code, start_date = None, end_date=None, frequency = 'daily', pollutant = 'PM 2.5'):
    '''
    returns the data to generate a pie chart given specific parameters
    '''
    records = get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
    
    good_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >0.0 and 
    records[i]['characteristics']['pm2_5ConcMass']['value'] <=12.0)

    moderate_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >12.0 and 
    records[i]['characteristics']['pm2_5ConcMass']['value'] <=35.4)

    UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >35.4 and 
    records[i]['characteristics']['pm2_5ConcMass']['value'] <=55.4)

    unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >55.4 and 
    records[i]['characteristics']['pm2_5ConcMass']['value'] <=150.4)

    v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >150.4 and 
    records[i]['characteristics']['pm2_5ConcMass']['value'] <=250.4)

    hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >250.4 and 
    records[i]['characteristics']['pm2_5ConcMass']['value'] <=500.4)

    unknowns_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] <0.0 or 
    records[i]['characteristics']['pm2_5ConcMass']['value'] > 500.4)
    
    tasks = [good_sum, moderate_sum, UH4SG_sum, unhealthy_sum, v_unhealthy_sum, hazardous_sum, unknowns_sum]

    #labels = 'Good', 'Moderate', 'UH4SG', 'Unhealthy', 'Very Unhealthy', 'Hazardous', 'Other'

    #records = []
    #for i in range(len(tasks)):
        #mydict = dict()
        #mydict['y'] = tasks[i]
        #mydict['label']= labels[i]
        #myjson= json.dumps(mydict)
       # records.append(mydict)
    
    #return tasks, labels
    #return records
    return tasks