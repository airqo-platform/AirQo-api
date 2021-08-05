#importing packages
from pymongo import MongoClient
from datetime import datetime, timedelta
import requests
import os
from dotenv import load_dotenv
load_dotenv()

EVENTS_URL = os.getenv('EVENTS_URL')
MONGO_URI = os.getenv('MONGO_GCE_URI')
client = MongoClient(MONGO_URI)

def connect_db(owner):
    """Connects to database

    Parameters
    ----------
    owner : str
        The database owner

    Returns
    -------
    db : Database
        a MongoDB connection
    """
    db_name = f'airqo_netmanager_{owner}'
    db = client[db_name]
    return db

def get_device_details(device_id, owner):
    """Returns a device's details given the ID

    Parameters
    ----------
    device_id : str
        The channel ID of the device
    owner: str
        The owner of the device

    Returns
    -------
    lat : float
        Latitude coordinate of the device's location
    lon: float
        Longitude coordinate of the device's location
    name: str
        Name of the device
    """
    db= connect_db(owner)    
    query = {
        'channelID': device_id
    }
    projection = {
        '_id': 0,
        'latitude': 1,
        'longitude': 1,
        'name':1,
        'channelID':1
    }
    records = list(db.devices.find(query, projection))
    lat, lon, name = records[0]['latitude'], records[0]['longitude'], records[0]['name']
    return lat, lon, name

def str_to_date(st):
    """Converts date string to datetime

    Parameters
    ----------
    st : str
        Date string

    Returns
    -------
    new_date : Datetime 
        Date from date string
    """
    new_date= datetime.strptime(st,'%Y-%m-%dT%H:%M:%S.%fZ')
    return new_date


def date_to_str(mydate):
    """Converts date string to datetime

    Parameters
    ----------
    mydate : date
        DateTime

    Returns
    -------
    date_string : str 
        String from datetime provided
    """
    date_string = datetime.strftime(mydate,'%Y-%m-%dT%H:%M:%SZ')
    return date_string


def get_pm_data(device_id, owner, verbose=True, frequency = 'raw', start_time='2021-05-01T01:00:00Z',end_time=datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')):
    """Gets the PM data of a particular device in a specified time period

    Parameters
    ----------
    device_id : str
        The channel ID of the device
    owner: str
        The owner of the device
    verbose: boolean
        Whether download progress is shown
    frequency: str
        The time frequency of the data
    start_time:
        The start time for the data download
    end_time:
        The end time for the data download

    Returns
    -------
    modified_result : list
        A list of dictionaries with the device's data
    
    """

    lat, lon, name = get_device_details(device_id, owner)
    url = EVENTS_URL #AirQo Platform Get Events endpoint
    result = [] #array to store all data downloaded for a device
    measurements_length= 1000 #standard response length from api
    count = 0 #iteration number
    while measurements_length==1000:
        count+=1
        parameters = {
            'tenant': owner,
            'device': name,
            'startTime': start_time,
            'endTime': end_time,
            'frequency':frequency,
            'recent': 'no'
        }
        if verbose:
            print(f'Iteration {count} - Start Time: {start_time}, End Time: {end_time}')
        try:
            response = requests.get(url, params=parameters)
            if response.status_code ==200:
                response_json = response.json()
                measurements = response_json['measurements']
                measurements_length = len(measurements)
                if measurements_length!=0:
                    result.extend(measurements)
                    new_end_time = measurements[-1]['time']
                    end_time = date_to_str(str_to_date(new_end_time) - timedelta(seconds=1))
            else:
                measurements_length=0
        except Exception as e:
            print(e)
            break
    #restructuring and removing unwanted fields
    modified_result = [{'time': x['time'],
                     'latitude': lat,
                     'longitude': lon,
                     'pm2_5': x['pm2_5']['value'],
                     #'calibrated_pm2_5': x['pm2_5']['calibratedValue'],
                     'pm10': x['pm10']['value'],
                    } for x in result]
    return modified_result


if __name__=='__main__':
    #example: getting data for one device
    test_array = get_pm_data('AW66FF7V', 'kcca')
    print(test_array)
        