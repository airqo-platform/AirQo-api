import json
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv

from config.constants import connect_mongo

load_dotenv()

MET_API_URL = os.getenv('MET_API_URL')
MET_API_CLIENT_ID = os.getenv('MET_API_CLIENT_ID')
MET_API_CLIENT_SECRET = os.getenv('MET_API_CLIENT_SECRET')

db = connect_mongo()


def load_json_data(full_file_path):
    """
        loads and returns json data from the specified file path.
    """
    data = None
    with open(full_file_path, 'r') as fp:
        data = json.load(fp)
    return data


def save_json_data(file_name, data_to_save):
    """
        saves data to a json file in the path specified by the file_name argument.
    """
    with open(file_name, 'w') as fp:
        json.dump(data_to_save, fp)


def get_all_gp_predictions():
    """
    returns pm 2.5 predictions for all airqloud
    """

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
    """
    returns pm 2.5 predictions for a particular airqloud
    """
    if airqloud is None:
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
    """
    returns pm 2.5 predictions for a particular airqloud
    """

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
    print('main')
