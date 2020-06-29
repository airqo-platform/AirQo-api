import base64
import datetime as dt
from bson import json_util, ObjectId
import json
from datetime import datetime,timedelta
from pymongo import MongoClient
import requests
import os

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db=client['airqo_analytics']

def function_to_execute(event, context):
    """Triggered from a message on a Cloud Pub/Sub topic.
    Args:
         event (dict): Event payload.
         context (google.cloud.functions.Context): Metadata for the event.
    """
    action = base64.b64decode(event['data']).decode('utf-8')

    if (action == "update_raw_clarity_data"):
         update_all_devices()
         

def insert_data_mongo(data):
    '''
    Inserts list of json objects into MongoDB if they don't exist.
    '''
    for i in data:
        key = {'_id': i['_id']}        
        db.device_raw_measurements.replace_one(key,i, upsert=True)
        #db['device_raw_measurements'].insert_one(i)

def get_last_time(device_code):
    '''
    Gets the time of the last record in the MongoDB
    '''     
    query = {'deviceCode': device_code}
    last_record = list(db.device_raw_measurements.find(query).sort([('time', -1)]).limit(1))
    last_time = last_record[0]['time']
    return last_time

def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')

def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date,'%Y-%m-%dT%H:%M:%S.%fZ')
    
def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')


def update_clarity_data(device_code):
        """
        Gets new data for a specific device and inserts into MongoDB
        """
        base_url = 'https://clarity-data-api.clarity.io/v1/measurements?'
        last_time = get_last_time(device_code)
        endtime = date_to_str(datetime.now())
        results_list = []
        api_url = base_url+'startTime='+date_to_str(last_time)+ '&endTime='+endtime+'&code='+device_code
        headers = {'x-api-key': 'qJ2INQDcuMhnTdnIi6ofYX5X4vl2YYG4k2VmwUOy','Accept-Encoding': 'gzip'}
        results = requests.get(api_url, headers=headers)
        json_results = results.json()
    
        for i in json_results:
            i['time'] = str_to_date(i['time'])
            i['device']= ObjectId(i['device'])
    
        if len(json_results) ==0:
            pass
        else:
            results_list.extend(json_results)
        insert_data_mongo(results_list)

def update_all_devices():
     devices_codes =  list(db.devices.find({},{"code": 1, "_id": 0}))
     for code in devices_codes:
          update_clarity_data(code['code'])
          print (code['code'], 'done')

