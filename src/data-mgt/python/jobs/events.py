import json
import os
import traceback
import requests

DEVICE_REGISTRY_STAGING_URL = os.getenv("DEVICE_REGISTRY_STAGING_URL")
DEVICE_REGISTRY_PRODUCTION_URL = os.getenv("DEVICE_REGISTRY_PRODUCTION_URL")
ENVIRONMENT = os.getenv("ENVIRONMENT", "STAGING")


class DeviceRegistry:

    def __init__(self, measurements, tenant, device_name):
        self.__measurements = measurements
        self.__tenant = tenant
        self.__device_name = device_name

    def insert_measurements(self):

        if ENVIRONMENT == 'PRODUCTION':
            self.__add_to_events_collection(DEVICE_REGISTRY_PRODUCTION_URL)

        self.__add_to_events_collection(DEVICE_REGISTRY_STAGING_URL)

    def __add_to_events_collection(self, base_url):

        try:

            json_data = json.dumps(self.__measurements)

            headers = {'Content-Type': 'application/json'}

            base_url = f"{base_url}devices/events/add?device={self.__device_name}&tenant={self.__tenant}"

            results = requests.post(base_url, json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print('\n')
                print(f"Device registry failed to insert values. Status Code : {str(results.status_code)}, Url : {base_url}")
                print(results.content)
                print('\n')

        except Exception as ex:
            traceback.print_exc()
            print(f"Error Occurred while inserting measurements: {str(ex)}")
