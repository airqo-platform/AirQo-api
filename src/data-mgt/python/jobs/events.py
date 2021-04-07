import copy
import json
import os
from threading import Thread
import traceback
import requests

DEVICE_REGISTRY_STAGING_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")
DEVICE_REGISTRY_PRODUCTION_URL = os.getenv("DEVICE_REGISTRY_PRODUCTION_URL")


def measurements_insertion(data, tenant):

    threads = []

    staging_data = copy.deepcopy(data)

    # production
    thread_production = Thread(target=production_insertion, args=(data, tenant,))
    threads.append(thread_production)
    thread_production.start()

    # staging
    thread_staging = Thread(target=staging_insertion, args=(staging_data, tenant,))
    threads.append(thread_staging)
    thread_staging.start()

    # wait for all threads to terminate
    for thread in threads:
        thread.join()


def staging_insertion(data, tenant):

    """
    sends device measurements to device registry microservice on staging environment
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
        url = DEVICE_REGISTRY_STAGING_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers)

        if results.status_code == 200:
            print(results.json())
        else:
            raise Exception("Device Registry staging failed to insert values. Status Code : " + str(results.status_code))

    except Exception as e:
        # traceback.print_exc()
        print(e)


def production_insertion(data, tenant):

    """
    sends device measurements to device registry microservice on production environment
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
        url = DEVICE_REGISTRY_PRODUCTION_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers)

        if results.status_code == 200:
            print(results.json())
        else:
            raise Exception("Device Registry production failed to insert values. Status Code : " + str(results.status_code))

        print(results.json())

    except Exception as e:
        print(e)