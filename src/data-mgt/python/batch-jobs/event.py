import json
import os

import requests

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


class DeviceRegistry:
    def __init__(self, data, tenant, url) -> None:
        self.json_data = json.dumps(data)
        self.tenant = tenant
        self.base_url = url
        
    def send_to_api(self):
        self.events_collection_insertion()

    def events_collection_insertion(self):
        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events?tenant=" + self.tenant

            results = requests.post(url, self.json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print(f"Device registry failed to insert values. Status Code : {results.status_code}")
                print(f"Response : {results.content}")
                print(f"Request Url : {url}")
                print(f"Request body : {self.json_data}")
        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))
