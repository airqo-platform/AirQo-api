# importing packages
from datetime import datetime, timedelta
import requests
from config import configuration, connect_mongo
import pandas as pd


def get_device_details(device_id, tenant):
    """Returns a device's details given the ID

    Parameters
    ----------
    device_id : str
        The channel ID of the device
    owner: str
        The owner of the device

    Returns
    -------
    lat : float
        Latitude coordinate of the device's location
    lon: float
        Longitude coordinate of the device's location
    name: str
        Name of the device
    """
    db = connect_mongo(tenant, db_host=configuration.MONGO_URI_DEVICE_REGISTRY)
    query = {"channelID": device_id}
    projection = {"_id": 0, "latitude": 1, "longitude": 1, "name": 1, "channelID": 1}
    records = list(db.devices.find(query, projection))
    lat, lon, name = records[0]["latitude"], records[0]["longitude"], records[0]["name"]
    return lat, lon, name


def str_to_date(st):
    """Converts date string to datetime

    Parameters
    ----------
    st : str
        Date string

    Returns
    -------
    new_date : Datetime
        Date from date string
    """
    new_date = datetime.strptime(st, "%Y-%m-%dT%H:%M:%S.%fZ")
    return new_date


def date_to_str(mydate):
    """Converts datetime to date string

    Parameters
    ----------
    mydate : date
        DateTime

    Returns
    -------
    date_string : str
        String from datetime provided
    """
    date_string = datetime.strftime(mydate, "%Y-%m-%dT%H:%M:%SZ")
    return date_string


def get_pm_data(
    name,
    lat,
    lon,
    tenant,
    frequency="hourly",
    verbose=True,
    start_time=(datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    end_time=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
):
    """Gets the PM data of a particular device in a specified time period

    Parameters
    ----------
    name : str
        The name of the device
    lat : float
        The latitude coordinate of the device
    long: float
        The longitude coordinate of the device
    tenant: str
        The owner of the device
    frequency: str
        The time frequency of the data
    verbose: boolean
        Whether download progress is shown
    start_time:
        The start time for the data download
    end_time:
        The end time for the data download

    Returns
    -------
    modified_result : list
        A list of dictionaries with the device's data

    """

    url = configuration.EVENTS_URI
    result = []
    measurements_length = 1000
    count = 0
    while measurements_length == 1000:
        count += 1
        parameters = {
            "tenant": tenant,
            "device": name,
            "startTime": start_time,
            "endTime": end_time,
            "frequency": frequency,
            "recent": "no",
        }
        if verbose:
            print(f"Iteration {count} - Start Time: {start_time}, End Time: {end_time}")
        try:
            response = requests.get(url, params=parameters)
            if response.status_code == 200:
                response_json = response.json()
                measurements = response_json["measurements"]
                measurements_length = len(measurements)
                if measurements_length != 0:
                    result.extend(measurements)
                    new_end_time = measurements[-1]["time"]
                    end_time = date_to_str(
                        str_to_date(new_end_time) - timedelta(seconds=1)
                    )
            else:
                measurements_length = 0
        except Exception as e:
            print(e)
            break
    # restructuring and removing unwanted fields
    modified_result = []
    for x in result:
        time = x["time"]
        try:
            pm2_5 = x["average_pm2_5"]["calibratedValue"]
        except:
            pm2_5 = x["average_pm2_5"]["value"]
        modified_result.append(
            {"time": time, "latitude": lat, "longitude": lon, "pm2_5": pm2_5}
        )
    return pd.DataFrame(modified_result)


if __name__ == "__main__":
    # example: getting data for one device
    test_array = get_pm_data("aq_29", 0.3075, 32.6206, "airqo")
    print(test_array.head())
