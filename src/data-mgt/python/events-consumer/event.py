import json
import os

import requests

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


class DeviceRegistry:
    def __init__(self, tenant, url) -> None:
        self.tenant = tenant
        self.base_url = url

    def insert_events(self, data):
        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events/add?tenant=" + self.tenant
            json_data = json.dumps(data)

            results = requests.post(url, json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print("Device registry failed to insert values. Status Code : " + str(results.status_code))
                print(results.content)

        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))
