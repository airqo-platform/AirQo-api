import json
import os

import requests
import pandas as pd

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


class DeviceRegistry:
    def __init__(self, data, tenant, url) -> None:
        self.json_data = json.dumps(data)
        self.tenant = tenant
        self.base_url = url
        
    def send_to_api(self):
        dataframe = pd.DataFrame(self.json_data)
        device = dataframe.iloc[0].get("device")
        self.events_collection_insertion(device)

    def events_collection_insertion(self,  device):
        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events/add?device=" + device + "&tenant=" + self.tenant

            results = requests.post(url, self.json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print("Device registry failed to insert values. Status Code : " + str(results.status_code))

        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))