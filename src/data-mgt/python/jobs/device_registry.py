import json
import os
import requests

AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")

MEASUREMENT_UNITS = dict({
    "temperature": "°C",
    "relHumid": "%",
    "pm10ConcMass": "μg/m3",
    "pm10ConcNum": "micrograms",
    "pm1ConcMass": "μg/m3",
    "pm1ConcNum": "micrograms",
    "pm2_5ConcMass": "μg/m3",
    "pm2_5ConcNum": "micrograms",
    "no2Conc": "ppb",
    "vocConc": "ppb",
    "co2Conc": "ppb",
})


def single_component_insertion(data, tenant):

    """
    inserts a single device component data into the events table
    :param data: component data (includes component name and device id to reduce on function args)
    :param tenant: organisation eg airqo
    :return: none
    """

    try:

        # extract the component name and device id from the data
        device = data.pop("device")

        # create a json object of the remaining data and post to events table
        json_data = json.dumps([data])
        # print(json_data)
        headers = {'Content-Type': 'application/json'}
        url = AIRQO_API_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers)

        print(results.json())

    except Exception as e:
        print("================ Error Occurred ==================")
        print(e)
        print("================ Error End ==================")


def get_component_type(component, tenant):

    """
    gets a component type if it exists, else creates it
    :param component: component name
    :param tenant: organisation eg airqo
    :raises an exception if it fails to retrieve or register a component type
    :return: component type
    """

    # get component type
    existing_component_type_url = AIRQO_API_BASE_URL + "devices/list/components/types?name=" + component + "&tenant=" + tenant
    existing_component_type_results = requests.get(existing_component_type_url)

    # register the component type if it doesnt exists
    if not existing_component_type_results.json()["doesExist"]:
        get_component_type_url = AIRQO_API_BASE_URL + "devices/add/components/types?name=" + component + "&tenant=" + tenant
        component_type_results = requests.post(get_component_type_url)

        if not component_type_results.json()["doesExist"]:
            # print(component_type_results.json())
            raise Exception("failed to create and retrieve component type")

        return component_type_results.json()["componentType"][0]["name"]

    else:
        return existing_component_type_results.json()["componentType"][0]["name"]


def get_component_details(device_code, component, tenant):

    """
    :param device_code: device id
    :param component:
    :param tenant: organisation
    :raises an exception if it fails to retrieve or register a component's details
    :return: component details
    """

    component_name = device_code + "_" + component

    # get component details
    get_component_details_url = AIRQO_API_BASE_URL + "devices/list/components?device=" + device_code + "&comp=" + \
                                component_name + "&tenant=" + tenant
    component_details_results = requests.get(get_component_details_url)

    # add component details if they dont exist
    if not component_details_results.json()["success"]:

        # get the units of the component type
        try:
            measurement_unit = MEASUREMENT_UNITS[component]
        except KeyError:
            measurement_unit = "unknown"

        add_component_body = dict({
            "measurement": [{
                "quantityKind": component,
                "measurementUnit": measurement_unit
                }],
            "description": component + " " + measurement_unit
        })

        add_component_body_json = json.dumps(add_component_body)

        # create the component type if it doesnt exist
        component_type = get_component_type(component, tenant)

        headers = {'Content-Type': 'application/json'}
        create_component_url = AIRQO_API_BASE_URL + "devices/add/components?device=" + device_code + "&ctype=" + component_type + "&tenant=" + tenant
        create_component_results = requests.post(create_component_url, add_component_body_json, headers=headers)

        if not create_component_results.json()["success"]:
            # print(create_component_results.json())
            raise Exception("failed to create and retrieve component")

        return create_component_results.json()["component"]

    else:
        return component_details_results.json()["component"]
