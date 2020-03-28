import helpers
from pymongo import MongoClient

def insert_data_mongo(data):
    """
    Inserts raw clarity data into MongoDB
    """
    client = MongoClient('mongodb+srv://lillian:fosho@cluster0-99jha.gcp.mongodb.net/test?retryWrites=true&w=majority')
    db=client['airqo_analytics']
    for i in data:
        db['device_raw_measurements'].insert_one(i)

def get_last_time(device_code):
    """
    Gets the time of the latest record in the MongoDB
    """
    client = MongoClient("mongodb+srv://lillian:fosho@cluster0-99jha.gcp.mongodb.net/test?retryWrites=true&w=majority")  
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
            start = helpers.str_to_date_find(start_date)
        if end_date == None:
            end = datetime.now()
        else:
            end = helpers.str_to_date_find(end_date)

        query = { 'deviceCode': device_code, 'time': {'$lte': end, '$gte': start} }
                                 
        if pollutant == 'PM 10':
            projection = { '_id': 0, 'time': 1, 'characteristics.pm10ConcMass.value':1 }
        else:
            projection = { '_id': 0, 'time': 1, 'characteristics.pm2_5ConcMass.value':1 }
                                 
        client = MongoClient("mongodb+srv://lillian:fosho@cluster0-99jha.gcp.mongodb.net/test?retryWrites=true&w=majority")  
        db=client['airqo_analytics']
                                 
        if frequency =='hourly':
            records = db.device_hourly_measurements.find(query, projection)
        else:
            records = db.device_daily_measurements.find(query, projection)
    
        return list(records)