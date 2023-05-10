import requests
from config import connect_mongo, configuration
from utils import previous_months_range, date_to_str, str_to_date
from datetime import timedelta


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
        # return self.db.sites.find()
        try:
            api_url = f'{configuration.AIRQO_API_BASE_URL}devices/sites?tenant={configuration.TENANT}'
            results = requests.get(api_url, verify=False)
            sites_data = results.json()["sites"]
        except Exception as ex:
            print("Sites Url returned an error : " + str(ex))
            sites_data = {}

        return sites_data


class Events(BaseModel):
    def __init__(self):
        super().__init__()

    


class Devices(BaseModel):
    def __init__(self):
        super().__init__()

    def get_devices():

        try:
            api_url = f'{configuration.AIRQO_API_BASE_URL}devices?tenant={configuration.TENANT}&active=yes'
            results = requests.get(api_url, verify=False)
            devices_data = results.json()["devices"]
        except Exception as ex:
            print("Devices Url returned an error : " + str(ex))
            devices_data = {}

        return devices_data
