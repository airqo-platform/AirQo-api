import json
import os
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv

from config.constants import connect_mongo

load_dotenv()

MET_API_URL = os.getenv('MET_API_URL')
MET_API_CLIENT_ID = os.getenv('MET_API_CLIENT_ID')
MET_API_CLIENT_SECRET = os.getenv('MET_API_CLIENT_SECRET')

db = connect_mongo()


def get_location_hourly_weather_forecasts(latitude: float, longitude: float):
    headers = {'x-ibm-client-id': MET_API_CLIENT_ID,
               'x-ibm-client-secret': MET_API_CLIENT_SECRET,
               'accept': "application/json"
               }

    parameters = {
        "excludeParameterMetadata": "true",
        "includeLocationName": "true",
        "latitude": latitude,
        "longitude": longitude
    }

    api_url = MET_API_URL

    forecast_results = requests.get(api_url, headers=headers, params=parameters)

    return forecast_results.json(), forecast_results.status_code


def load_json_data(full_file_path):
    '''
        loads and returns json data from the specified file path. 
    '''
    data = None
    with open(full_file_path, 'r') as fp:
        data = json.load(fp)
    return data


def save_json_data(file_name, data_to_save):
    '''
        saves data to a json file in the path specified by the file_name argument.
    '''
    with open(file_name, 'w') as fp:
        json.dump(data_to_save, fp)


def get_all_gp_predictions():
    '''
    returns pm 2.5 predictions for all airqloud
    '''

    today = datetime.today()
    query = {"created_at": {"$gt": today - timedelta(minutes=60)}}
    projection = {'_id': 0,
                  'latitude': 1,
                  'longitude': 1,
                  'predicted_value': 1,
                  'variance': 1,
                  'interval': 1,
                  'airqloud': 1,
                  'created_at': 1,
                  'airqloud_id': 1,
                  'values': 1}
    records = list(db.gp_predictions.find(query, projection))
    return records


def get_gp_predictions(airqloud):
    '''
    returns pm 2.5 predictions for a particular airqloud
    '''
    # try:
    #     client = MongoClient(MONGO_URI)
    # except pymongo.errors.ConnectionFailure as e:
    #     return {'message':'unable to connect to database', 'success':False}, 400

    # db = client[DB_NAME]
    if airqloud == None:
        records = get_all_gp_predictions()
    else:
        query = {'airqloud': airqloud}
        projection = {'_id': 0,
                      'latitude': 1,
                      'longitude': 1,
                      'predicted_value': 1,
                      'variance': 1,
                      'interval': 1,
                      'airqloud': 1,
                      'created_at': 1,
                      'airqloud_id': 1,
                      'values': 1}
        records = list(db.gp_predictions.find(query, projection))
    return records


def get_gp_predictions_id(aq_id):
    '''
    returns pm 2.5 predictions for a particular airqloud
    '''
    # try:
    #     client = MongoClient(MONGO_URI)
    # except pymongo.errors.ConnectionFailure as e:
    #     return {'message':'unable to connect to database', 'success':False}, 400

    # db = client[DB_NAME]
    query = {'airqloud_id': aq_id}
    projection = {'_id': 0, 'latitude': 1, 'longitude': 1, 'predicted_value': 1, 'variance': 1, 'interval': 1,
                  'airqloud': 1, 'created_at': 1, 'airqloud_id': 1}
    records = list(db.gp_predictions.find(query, projection))
    return records


def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%d %H:%M:%S')


if __name__ == '__main__':
    # get_closest_channel(0.540184, 31.)
    print('main')
