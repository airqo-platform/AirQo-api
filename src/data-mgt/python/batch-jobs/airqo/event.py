import json
import math
import os
from datetime import datetime
from threading import Thread

import requests
import luigi
import pandas as pd
import numpy as np
from google.cloud import bigquery
from pandas import Series

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")
os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


def send_to_api(data):
    dataframe = pd.DataFrame(data["measurements"])

    # groups = dataframe.groupby("device")
    # for index, group in groups:
    device = dataframe.iloc[0].get("device")
    json_data = json.dumps(data["measurements"])
    # print(device)
    # print(json_data)
    # chunks = np.array_split(group, 20)
    # for chunk in chunks:
    # print(device)
    # print(dataframe.to_json())
    events_collection_insertion(json_data, "airqo", device)


def events_collection_insertion(data, tenant, device):
    # expects json
    try:

        headers = {'Content-Type': 'application/json'}
        url = DEVICE_REGISTRY_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, data, headers=headers, verify=False)

        if results.status_code == 200:
            print(results.json())
        else:
            print("Device registry failed to insert values. Status Code : " + str(results.status_code))

    except Exception as ex:
        print("Error Occurred while inserting measurements: " + str(ex))