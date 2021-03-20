import json
import os
import requests

AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")


def events_collection_insertion(data, tenant):

    """
    inserts device measurements data into the events collection
    :param data: component data (includes device name to reduce on function args)
    :param tenant: organisation eg airqo
    :return: none
    """

    try:

        # extract the component name and device id from the data
        device = data.pop("device")

        # create a json object of the remaining data and post to events table
        json_data = json.dumps([data])

        headers = {'Content-Type': 'application/json'}
        url = AIRQO_API_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers)

        print(results.json())

    except Exception as e:
        print(e)
