import requests
import json
import pandas as pd
from config import connect_mongo, configuration
from utils import previous_months_range, date_to_str, str_to_date, is_key_exist
from datetime import datetime, timedelta


class BaseModel:
    def __init__(self):
        self.db = connect_mongo()

class BoundaryLayer(BaseModel):
    def __init__(self):
        super().__init__()

    def get_boundary_layer(self):
        return self.db.boundaries.find()


class Site(BaseModel):
    def __init__(self):
        super().__init__()

    def get_sites():
        #return self.db.sites.find()
        try:
            api_url = f'{configuration.AIRQO_API_BASE_URL}devices/sites?tenant={configuration.TENANT}'
            results = requests.get(api_url,verify=False)
            sites_data = results.json()["sites"]
        except Exception as ex:
            print("Sites Url returned an error : " + str(ex))
            sites_data = {}

        return sites_data


class Events(BaseModel):
    def __init__(self):
        super().__init__()

    def get_events_db(self):
        # TODO add two/three months data filtering
        start_date, _ = previous_months_range(int(configuration.MONTHS_OF_DATA))
        created_at = str_to_date(date_to_str(
            start_date.replace(microsecond=0, second=0, minute=0) - timedelta(days=4)))
        print("created at", created_at)
        time_format = '%Y-%m-%dT%H:%M:%S%z'
        query = {'$match': {'first': {'$gte': created_at}}}
        projection = {'$project': {
            '_id': 0,
            'first': {
                '$dateToString': {
                    'format': time_format, 'date': '$first', 'timezone': 'Africa/Kampala'
                }},
            'values': {
                'pm2_5': 1,
                'device_number': 1,
                'time': 1
            }
        }}

        return list(self.db.events.aggregate([query, projection]))

    def get_events(self):
        try:
            api_url = f'{configuration.AIRQO_API_BASE_URL}device/events?tenant={configuration.TENANT}&active=yes&startTime=2021-11-19'
            results = requests.get(api_url,verify=False)
            events_data = results.json()["measurements"]
        except Exception as ex:
            print("Events Url returned an error : " + str(ex))
            events_data = {}

        return events_data


class Devices(BaseModel):
    def __init__(self):
        super().__init__()
    
    def get_devices():
  
        try:
            api_url = f'{configuration.AIRQO_API_BASE_URL}devices?tenant={configuration.TENANT}&active=yes'
            results = requests.get(api_url,verify=False)
            devices_data = results.json()["devices"]
        except Exception as ex:
            print("Devices Url returned an error : " + str(ex))
            devices_data = {}

        return devices_data