import json
import os

import requests

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


class DeviceRegistry:
    def __init__(self, data, tenant, url) -> None:
        self.json_data = json.dumps(data)
        self.tenant = tenant
        self.base_url = url

    def insert_events(self):
        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events/add?tenant=" + self.tenant

            results = requests.post(url, self.json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print("Device registry failed to insert values. Status Code : " + str(results.status_code))
                print(results.content)

        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))
