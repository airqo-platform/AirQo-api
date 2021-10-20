import json
import os

import requests
import urllib3
from dotenv import load_dotenv

load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class DeviceRegistry:
    def __init__(self, tenant, url) -> None:
        self.tenant = tenant
        self.base_url = url
        self.timeout = os.getenv("TIMEOUT")

    def insert_events(self, data):

        data_dict = list(data)
        measurements = []
        for row in data_dict:
            row_dict = dict(row)
            measurements.append(row_dict)

        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events?tenant=" + self.tenant
            json_data = json.dumps(measurements)

            response = requests.post(url, json_data, headers=headers, verify=False, timeout=int(self.timeout))

            if response.status_code == 200:
                print(response.json())
            else:
                print("Device registry failed to insert values. Status Code : " + str(response.status_code))
                print(response.content)
                print(response.request.url)
                print(response.request.body)

        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))

