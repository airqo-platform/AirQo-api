import json
import os
import requests

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")


def measurements_insertion(data, tenant):

    """
    sends device measurements to device registry microservice
    :param data: device measurements (includes device name to reduce on function args)
    :param tenant: organisation eg airqo
    :return: none
    """

    try:

        # obtain the device from the data
        device = data.pop("device")

        # create a json object of the remaining data and post to device registry
        json_data = json.dumps([data])

        headers = {'Content-Type': 'application/json'}
        url = DEVICE_REGISTRY_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers)

        print(results.json())

    except Exception as e:
        print(e)
