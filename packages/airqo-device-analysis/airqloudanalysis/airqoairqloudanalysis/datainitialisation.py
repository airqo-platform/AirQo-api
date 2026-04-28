import json
import numpy as np
from pandas import json_normalize
import requests
import pandas as pd
import time
import glob
import os
from os import read

from .datainitialisation import create_dates

#Other important libaries for datetime + timezone, OS for interacting with the operating system, requests for sending HTTP requests, BeautifulSoup for web scrapping
#Str to datetime library
from pytz import all_timezones
from datetime import datetime, timedelta, date
from dateutil import parser
#python libraries needed
from collections import defaultdict
#Datetime modifier libraries
import matplotlib.units as munits
import matplotlib.dates as mdates

#Visualization Libraries
import seaborn as sns
import matplotlib.pyplot as plt

#Interactive Plots Libraries
from plotly import __version__
from plotly.offline import download_plotlyjs, init_notebook_mode, plot, iplot#importing libraries from plotly offline
import cufflinks as cf
init_notebook_mode(connected=True)#connecting javascript to notebook to allow access visualization
cf.go_offline()
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

#Other lib picked as I created the notebook
from re import X

converter = mdates.ConciseDateConverter()
munits.registry[np.datetime64] = converter
munits.registry[date] = converter

#df = df[[, , , ]]
device_id_literal = "Device ID"
read_key_literal = "Read Key"
device_number_literal='Device Number'
read_key_literal_1='Read Key'
device_id_literal_1='Device ID'
airqloud_number_literal='AirQloud'
time_difference_flag_literal='Time Difference Flag'
sensor1_pm25_literal="Sensor1 PM2.5_CF_1_ug/m3"
sensor1_pm10_literal="Sensor1 PM10_CF_1_ug/m3"
sensor2_pm25_literal="Sensor2 PM2.5_CF_1_ug/m3"
sensor2_pm10_literal="Sensor2 PM10_CF_1_ug/m3"
latitude_literal="Latitude"
longitude_literal="Longitude"
latitude_literal_1='Latitude'
longitude_literal_1='Longitude'
battery_voltage_literal="Battery Voltage"


"""# Data initialisation functions
## Data processing"""
#Function to preprocess the datasets from the API
def preprocessing(df):
    # df.drop(columns=['field8'], inplace=True)
    # Convert str columns to float
    for col in ['field1', 'field2', 'field3', 'field4', 'field7']:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # Drop rows where any of the important columns have NaN values
    df = df.dropna(subset=["field1", "field2", "field3", "field4", "field7"])

    # Rename columns for clarity
    df = df.rename(columns={
        "field1": sensor1_pm25_literal,
        "field2": sensor1_pm10_literal,
        "field3": sensor2_pm25_literal,
        "field4": sensor2_pm10_literal,
        "field5": latitude_literal,
        "field6": longitude_literal,
        "field7": battery_voltage_literal
    })

    # Datetime data preprocessing
    df['created_at'] = pd.to_datetime(df['created_at'].apply(lambda x: parser.parse(x)))  # str to datetime type
    df['Date'] = df['created_at'].dt.date

    # Drop the extra Latitude and Longitude columns as they're not needed for further analysis
    df.drop([latitude_literal_1, longitude_literal_1], axis=1, inplace=True)

    # Calculate the mean PM2.5 and PM10 values
    df["Mean PM2.5"] = (df[sensor1_pm25_literal] + df[sensor2_pm25_literal]) / 2
    df["Mean PM10"] = (df[sensor1_pm10_literal] + df[sensor2_pm10_literal]) / 2

    # Drop the 'entry_id' column if it's not necessary
    df.drop(columns=["entry_id"], inplace=True, errors='ignore')

    # Reset index for neatness
    df.reset_index(drop=True, inplace=True)

    return df
# preprocessing(data)


"""## Create the weekly data"""
def calculate_days_between(start, end):
    # Convert the date strings to datetime objects
    start_date = datetime.strptime(start, '%Y-%m-%d')
    end_date = datetime.strptime(end, '%Y-%m-%d')

    # Calculate the difference in days
    delta = end_date - start_date

    # Return the difference in days
    return delta.days

def create_dates(start, end):
    # Parse the input dates   
    start_date = pd.to_datetime(start)
    end_date = pd.to_datetime(end)

    # Calculate the total number of days between the start and end dates
    total_days = calculate_days_between(start, end)

    # Calculate how many full 8-day intervals fit, and the remainder
    full_intervals = total_days // 8
    remainder = total_days % 8
    
    # Generate the main part of the date range with '8D' frequency
    if full_intervals > 0:
        main_range = pd.date_range(start=start_date, periods=full_intervals + 1, freq='8D')
    else:
        main_range = pd.Series([start_date])
    
    # Handle the remainder: create the final date as `start_date + total_days` and append
    if remainder > 0:
        last_date = start_date + pd.Timedelta(days=total_days)
        full_range = pd.concat([pd.Series(main_range), pd.Series([last_date])], ignore_index=True)
    else:
        full_range = pd.Series(main_range)

    # Create a DataFrame with the generated date range
    df = pd.DataFrame(full_range, columns=['Date'])
    
    # Recalculate the number of days between the first and last date in the DataFrame
    if not df.empty:
        first_date_in_df = df['Date'].iloc[0].strftime('%Y-%m-%d')
        last_date_in_df = df['Date'].iloc[-1].strftime('%Y-%m-%d')
        days_between_df_dates = calculate_days_between(first_date_in_df, last_date_in_df)
    else:
        days_between_df_dates = 0
        first_date_in_df = start
        last_date_in_df = end

    return df, days_between_df_dates, first_date_in_df, last_date_in_df
# this is a code sample : df, days_between_df_dates, first_date_in_df, last_date_in_df = create_dates(start, end)


"""
Retriving the data by fetching the max number of records at a time
"""
def fetch_all_records(channel_id, api_key, start_date, end_date):
    current_end = end_date  # Start fetching from the end date
    all_data = []  # List to store all fetched data

    #converting channel_id to string
    channel_id = str(channel_id)

    while True:
        # Generate the URL for the current chunk
        url = (
            f"https://thingspeak.com/channels/{channel_id}/feeds.json?"
            f"start={start_date}T00:00:00Z&end={current_end}T23:59:59Z&api_key={api_key}&results=8000"
        )
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            break
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON response: {e}")
            break

        # Get the feeds from the response
        feeds = data.get("feeds", [])
        if not feeds:
            print("No more feeds to fetch.")
            break

        # Append feeds to the all_data list
        all_data.extend(feeds)

        # Check if the number of feeds is less than the maximum limit (8000)
        if len(feeds) < 8000:
            print(f"Fetched {len(feeds)} records in the last batch. All records retrieved.")
            break

        # Get the timestamp of the first record in this chunk
        first_timestamp = feeds[0]["created_at"]
        first_datetime = datetime.strptime(first_timestamp, "%Y-%m-%dT%H:%M:%SZ")

        # Stop if the first record's timestamp is earlier than or equal to the start_date
        if first_datetime <= datetime.strptime(start_date, "%Y-%m-%d"):
            print("Fetched all records up to the start date.")
            break

        # Update the end time for the next request
        current_end = first_datetime.strftime("%Y-%m-%dT%H:%M:%S")
        print(f"Fetching next chunk up to {current_end}")

    # Convert the collected data into a Pandas DataFrame
    df = pd.DataFrame(all_data)

    # Check if 'entry_id' column exists before dropping NAs
    if 'entry_id' in df.columns:
        # delete na entry_id
        df = df.dropna(subset=['entry_id'])

        # organise based i=on entry_id
        df = df.sort_values(by='entry_id')
        df.reset_index(drop=True, inplace=True)

        # delete duplicate entry_id
        df = df.drop_duplicates(subset='entry_id', keep='first')
        df.reset_index(drop=True, inplace=True)
    else:
        # print row without entry_id
        print("Warning: 'entry_id' column not found in the data.")

    # print(df)
    return df



"""## URL functions"""
#Function to generate the url for the APIs from thingspeak
def url( id, key, start, end):
  url = 'https://thingspeak.com/channels/'+str(id)+'/feeds.json?start='+str(start)+'T00:00:00Z&end='+str(end)+'T23:59:59Z&api_key='+str(key)
  return url
# url(123456, 'ABCD1234', start, end)

#Function to generate the last url for the APIs from thingspeak for the time off functionality
def last_url(id, key):
  last_url = 'https://thingspeak.com/channels/' + str(id) + '/feeds.json?api_key=' + str(key) + '&results=1'
  #this is a unused code :  last_url = 'https://thingspeak.com/channels/' + str(id) + '/feeds/last.json?api_key=' + str(key)
  return last_url
# last_url(123456, 'ABCD1234')


"""## DataFrame airqloud formation"""
"""## by API"""
baseApiURL = "https://api.airqo.net/api/v2/devices"
REQUEST_TIMEOUT = 30

def get_device_data(token):
    url = f"{baseApiURL}?token={token}"
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
#get_device_data("your_token")

def get_site_data(token):
    url = f"{baseApiURL}/grids/summary?token={token}"
    response = requests.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()
#get_site_data("your_token")

def decrypt_data(token, data):
    url = f"{baseApiURL}/decrypt/bulk?token={token}"
    response = requests.post(url, json=data, timeout=REQUEST_TIMEOUT)

    if response.status_code == 200:
        # print(response.json())
        return response.json()
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return None
#decrypt_data("your_token", "your_data")

def process_site_data(token):
    # Fetch site data
    site_data = get_site_data(token)

    if site_data.get('success') and 'grids' in site_data:
        grids = site_data['grids']
        data = [{"name": grid["name"], "admin_level": grid["admin_level"]} for grid in grids]

        df = pd.DataFrame(data)
        grouped_df = df.groupby('admin_level').apply(lambda x: x[['name']].reset_index(drop=True))

        return grouped_df
    else:
        print("Error: No grids data available")
        return pd.DataFrame()
#this is a sample code usage: grouped_df=process_site_data("your_token")

def _is_lowcost_device(device):
    category = device.get("category")
    return category == "lowcost" or category is None


def _build_grid_entry(device, grid):
    device_number = device.get("device_number")
    return {
        "Device Number": device.get("long_name"),
        device_id_literal: str(device_number) if device_number is not None else None,
        read_key_literal: device.get("readKey"),
        "grid_id": grid.get("_id"),
        "grid_name": grid.get("name"),
        "admin_level": grid.get("admin_level"),
    }


def _collect_device_grid_entries(devices, air_qlouds):
    data_list = []
    for device in devices:
        if not _is_lowcost_device(device):
            continue
        for grid in device.get("grids", []):
            grid_name = grid.get("name") or ""
            if any(air_qloud in grid_name for air_qloud in air_qlouds):
                data_list.append(_build_grid_entry(device, grid))
    return data_list


def _apply_decrypted_keys(df, token):
    encryption_data = [
        {
            "encrypted_key": row[read_key_literal],
            "device_number": int(row[device_id_literal]),
        }
        for _, row in df.iterrows()
    ]
    decrypted_data = decrypt_data(token, encryption_data)

    if not (decrypted_data and decrypted_data.get('decrypted_keys')):
        return df

    decrypted_keys = [d.get('decrypted_key') for d in decrypted_data['decrypted_keys']]
    if len(decrypted_keys) == len(df):
        df["Decrypted Read Key"] = decrypted_keys
    else:
        print("Mismatch between decrypted keys and DataFrame length")
    return df


def airqloudlist_api(token, air_qlouds):
    device_data = get_device_data(token)

    if not device_data.get("success"):
        print("Error fetching device data")
        data_list = []
    else:
        data_list = _collect_device_grid_entries(device_data.get("devices", []), air_qlouds)

    df = pd.DataFrame(data_list)
    df = df.dropna(subset=[device_id_literal])
    df = df.dropna(subset=[read_key_literal])

    df = _apply_decrypted_keys(df, token)

    df = df.drop(columns=[read_key_literal])
    df = df.rename(columns={
        "Decrypted Read Key": read_key_literal,
        "grid_name": "AirQloud",
        "grid_id": "AirQloud ID",
        "admin_level": "AirQloud Type",
    })

    return df
# This is sample code : df = airqloudlist_api(token)

"""## by google drive"""
_AQ_COLUMNS = [device_number_literal, read_key_literal_1, device_id_literal_1, airqloud_number_literal]
_AQ_DTYPES = dict.fromkeys(_AQ_COLUMNS, str)


def _read_airqloud_sheet(filepath, sheet_name):
    df = pd.read_excel(filepath, sheet_name=sheet_name)
    df[airqloud_number_literal] = sheet_name
    df = df[_AQ_COLUMNS]
    return df.astype(_AQ_DTYPES)


def _airqloudlist_by_airqlouds(filepath, excelfile, air_qlouds):
    dfs = [
        _read_airqloud_sheet(filepath, sheet_name)
        for sheet_name in excelfile.sheet_names
        if sheet_name in air_qlouds
    ]
    return pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame(columns=_AQ_COLUMNS)


def _airqloudlist_by_devices(filepath, excelfile, device_names):
    dfs = [_read_airqloud_sheet(filepath, sheet_name) for sheet_name in excelfile.sheet_names]
    if not dfs:
        return pd.DataFrame(columns=_AQ_COLUMNS)
    aq_data = pd.concat(dfs, ignore_index=True)
    return aq_data[aq_data[device_number_literal].isin(device_names)].reset_index(drop=True)


def airqloudlist(filepath, excelfile, air_qlouds, device_names):
    if air_qlouds and device_names:
        return "air_qlouds and device_names  can not both have data"
    if air_qlouds:
        return _airqloudlist_by_airqlouds(filepath, excelfile, air_qlouds)
    if device_names:
        return _airqloudlist_by_devices(filepath, excelfile, device_names)
    return "either air_qlouds or device_names must have data"
# this is the code sample : AQData = airqloudlist(file_path, excel_file, air_qlouds, device_names)


"""## initializing dataframe"""
def process_data(df, start, end):
    all_data = []  # List to store data for all devices

    for index, row in df.iterrows():
        device_number = row[device_number_literal]
        read_key = row[read_key_literal_1]
        device_id = row[device_id_literal_1]
        deviceDataFrame = pd.DataFrame()  # Initialize an empty DataFrame for each device

        # Fetch the raw data for this device
        raw_data = fetch_all_records(device_id, read_key, start, end)

        # Preprocess the data
        if raw_data.empty:
            print(f"No data found for Device Number {device_number}")
            continue  # Skip empty datasets

        # Preprocessing the raw data
        deviceDataFrame = preprocessing(raw_data)

        # Check if deviceDataFrame is not empty
        if not deviceDataFrame.empty:
            # Add Device Number as a column
            deviceDataFrame[device_number_literal] = device_number
            all_data.append(deviceDataFrame)  # Append the processed data to the list
            print("Done", device_number)
        else:
            print(f"No valid data for Device Number {device_number}")

    # Concatenate all device data into one DataFrame
    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
    else:
        final_df = pd.DataFrame()  # If all_data is empty, return an empty DataFrame

    # Merge with the original AQData based on device_number_literal
    if not final_df.empty:
        final_df = pd.merge(final_df, df, on=[device_number_literal], how='left')
    else:
        print("Final DataFrame is empty after concatenation.")

    return final_df
# this is sample code : final_df = process_data(AQData, start, end)

def process_data_v1(device_dict_list, start, end):
    """
    Variation 1: Takes in _id list, readkey list, device_number list (as a list of dictionaries),
    and returns json data (list of dictionaries) with battery, pm2.5 sensor1 and pm2.5 sensor2.
    """
    all_data = []

    for device in device_dict_list:
        device_number = device.get('device_number')
        read_key = device.get('readkey')
        device_id = device.get('_id')

        # Fetch the raw data for this device
        raw_data = fetch_all_records(device_id, read_key, start, end)

        if raw_data.empty:
            print(f"No data found for Device Number {device_number}")
            continue

        # Keep columns if they exist, ignoring missing ones to prevent KeyError
        columns_to_keep = ['created_at'] + [col for col in ['field1', 'field3', 'field7'] if col in raw_data.columns]
        df = raw_data[columns_to_keep].copy()

        for col in ['field1', 'field3', 'field7']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        df = df.rename(columns={
            "field1": "pm2.5 sensor1",
            "field3": "pm2.5 sensor2",
            "field7": "battery"
        })

        df['device_number'] = device_number
        df['device_id'] = device_id
        all_data.append(df)

    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
        return final_df.to_dict(orient='records')
    else:
        return []

def process_data_v2(device_dict_list, start, end):
    """
    Variation 2: Takes in _id list, readkey list, device_number list (as a list of dictionaries),
    and returns json data (list of dictionaries) with field2, field3, field4 mapped to ConcRT, ConcHR, ConcS.
    """
    all_data = []

    for device in device_dict_list:
        device_number = device.get('device_number')
        read_key = device.get('readkey')
        device_id = device.get('_id')

        # Fetch the raw data for this device
        raw_data = fetch_all_records(device_id, read_key, start, end)

        if raw_data.empty:
            print(f"No data found for Device Number {device_number}")
            continue

        columns_to_keep = ['created_at'] + [col for col in ['field2', 'field3', 'field4'] if col in raw_data.columns]
        df = raw_data[columns_to_keep].copy()

        for col in ['field2', 'field3', 'field4']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

        df = df.rename(columns={
            "field2": "ConcRT(ug/m3)",
            "field3": "ConcHR(ug/m3)",
            "field4": "ConcS(ug/m3)"
        })

        df['device_number'] = device_number
        df['device_id'] = device_id
        all_data.append(df)

    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
        return final_df.to_dict(orient='records')
    else:
        return []

def _fetch_missing_ranges(airqloud_df, startdate, enddate, existing_start, existing_end):
    """Return a list of new DataFrames covering ranges not already in existing data."""
    # Range fully covered by existing data
    if startdate >= existing_start and enddate <= existing_end:
        return []

    # New range starts after existing start and ends after existing end
    if startdate > existing_start and enddate > existing_end:
        return [process_data(airqloud_df, existing_end, enddate)]

    # New range starts before existing start and ends before existing end
    if startdate < existing_start and enddate < existing_end:
        return [process_data(airqloud_df, startdate, existing_start)]

    # New range extends on both sides of existing data
    if startdate < existing_start and enddate > existing_end:
        return [
            process_data(airqloud_df, startdate, existing_start),
            process_data(airqloud_df, existing_end, enddate),
        ]

    return []


def _process_single_airqloud(airqloud_df, airqloud, startdate, enddate, airqlouds_csv):
    """Process one airqloud, returning the resulting DataFrame or None to skip."""
    matching_file = glob.glob(os.path.join(airqlouds_csv, f"*{airqloud}*"))
    if not matching_file:
        return None

    existing_data = pd.read_csv(matching_file[0])
    existing_start = existing_data['Date'].min()
    existing_end = existing_data['Date'].max()

    if existing_start == startdate and existing_end == enddate:
        return existing_data

    new_ranges = _fetch_missing_ranges(
        airqloud_df, startdate, enddate, existing_start, existing_end
    )

    final_df = pd.concat([existing_data, *new_ranges]) if new_ranges else existing_data
    return final_df[(final_df['Date'] >= startdate) & (final_df['Date'] <= enddate)]


def process_data_function(df, startdate, enddate, airqlouds_csv):
    for airqloud in df[airqloud_number_literal].unique():
        airqloud_df = df[df[airqloud_number_literal] == airqloud]
        result = _process_single_airqloud(
            airqloud_df, airqloud, startdate, enddate, airqlouds_csv
        )
        if result is not None:
            return result
    return None

"""## Device time off"""
def time_last_post(df):
    results = []
    for index, row in df.iterrows():
        device_number = row[device_number_literal]
        read_key = row[read_key_literal_1]
        device_id = row[device_id_literal_1]
        airqloud = row[airqloud_number_literal]
        last = last_url(device_id, read_key)

        # Fetch data from the API
        try:
            last_data = requests.get(last)
            last_data = last_data.json()
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            print(f"Error fetching data for Device ID {device_id}: {e}")
            continue  # Skip to the next row

        # Check if 'feeds' exists and is not empty
        if 'feeds' not in last_data or not last_data['feeds']:
            print(f"No data found in feeds for Device ID {device_id}")
            continue  # Skip to the next row

        # Extract and parse the created_at timestamp
        created_at_str = last_data['feeds'][0]['created_at']
        created_at = datetime.strptime(created_at_str, '%Y-%m-%dT%H:%M:%SZ')

        current_time = datetime.utcnow()
        time_difference = current_time - created_at
        time_diff_flag = 1 if time_difference < timedelta(days=1) else 0


        results.append({
            device_number_literal: device_number,
            time_difference_flag_literal: time_diff_flag,
            'Time Difference': time_difference,
            airqloud_number_literal: airqloud
        })

    result_df = pd.DataFrame(results)
    return result_df
# this is sample code : device_time_diff = time_last_post(AQData)

def online_device_list(df):
    # Filter the DataFrame to only include rows where Time Difference Flag is 1
    filtered_df = df[df[time_difference_flag_literal] == 1]

    return filtered_df

def offline_device_list(df):
    # Filter the DataFrame to only include rows where Time Difference Flag is 0
    filtered_df = df[df[time_difference_flag_literal] == 0]

    return filtered_df

"""## Uptime variable  initialisation"""
# Function to calculate the average uptime of the devices
def calculate_uptime(df, start, end):
    # Initialize lists to store results
    average_device_uptime = []
    average_completeness_lst = []
    device_uptime = []
    device_completeness = []
    device_list = []
    airqloud_list = []
    optimal_completeness_lst = []
    good_completeness_lst = []
    fair_completeness_lst = []
    poor_completeness_lst = []
    sensor_error = []
    error_dfs = []

    # Iterate over unique device numbers
    for device_number in df[device_number_literal].unique():
        # Filter data for the current device
        device_df = df[df[device_number_literal] == device_number]

        # Convert 'created_at' column to datetime
        device_df['created_at'] = pd.to_datetime(device_df['created_at'])

        # Extract date and hour
        device_df['date'] = device_df['created_at'].dt.date
        device_df['hour'] = device_df['created_at'].dt.hour
        device_df['timestamp'] = device_df['created_at'].dt.strftime('%Y-%m-%d %H')
        device_df['Error margin'] = np.abs(device_df['Sensor1 PM2.5_CF_1_ug/m3'] - device_df['Sensor2 PM2.5_CF_1_ug/m3'])

        # Group by date and count unique hours for uptime
        uptime_df = device_df.groupby('date')['hour'].nunique().reset_index(name='uptime')
        completeness_df = device_df.groupby(['timestamp']).size().reset_index(name='data_entries')
        #this is a code sample :  error = magnitude('Sensor1 PM2.5_CF_1_ug/m3' - 'Sensor2 PM2.5_CF_1_ug/m3')
        error_df = device_df.groupby(['timestamp'])['Error margin'].mean().reset_index(name='error')


        # Calculate average uptime
        # average_uptime = round(uptime_df['uptime'].mean(), 2)
        # calculate average uptime is the sum of the uptime divided by the number of days between the start and end date which are strings
        average_uptime = round(uptime_df['uptime'].sum() / (calculate_days_between(start, end) + 1), 2)
        average_completeness = round(completeness_df['data_entries'].mean(), 2)
        average_error = round(error_df['error'].mean(), 2)

        # Calculate completeness categories
        optimal_count = completeness_df[completeness_df['data_entries'] > 18].shape[0]
        good_count = completeness_df[(completeness_df['data_entries'] >= 15) & (completeness_df['data_entries'] <= 18)].shape[0]
        fair_count = completeness_df[(completeness_df['data_entries'] >= 10) & (completeness_df['data_entries'] <= 14)].shape[0]
        poor_count = completeness_df[(completeness_df['data_entries'] >= 1) & (completeness_df['data_entries'] <= 9)].shape[0]

        # Append results to lists
        device_list.append(device_number)
        airqloud_list.append(device_df[airqloud_number_literal].iloc[0])
        average_device_uptime.append(average_uptime)
        device_uptime.append(uptime_df)
        device_completeness.append(completeness_df)
        average_completeness_lst.append(average_completeness)
        optimal_completeness_lst.append(optimal_count)#(round(((optimal_count/(optimal_count + good_count + fair_count + poor_count)) * 100),2))
        good_completeness_lst.append(good_count)#(round(((good_count/(optimal_count + good_count + fair_count + poor_count)) * 100),2))
        fair_completeness_lst.append(fair_count)#(round(((fair_count/(optimal_count + good_count + fair_count + poor_count)) * 100),2))
        poor_completeness_lst.append(poor_count)#(round(((poor_count/(optimal_count + good_count + fair_count + poor_count)) * 100),2))
        sensor_error.append(average_error)
        error_dfs.append(error_df)

    # Create final DataFrame to return
    result_df = pd.DataFrame({
        device_number_literal: device_list,
        'Average Uptime': average_device_uptime,
        'Device Uptime': device_uptime,
        'Sensor Error' : error_dfs,
        'Average Sensor Error': sensor_error,
        'Device Completeness': device_completeness,
        'Average Completeness': average_completeness_lst,
        'Optimal Completeness': optimal_completeness_lst,
        'Good Completeness': good_completeness_lst,
        'Fair Completeness': fair_completeness_lst,
        'Poor Completeness': poor_completeness_lst
    })

    return result_df
#  this is a code sample : final_uptime_data = calculate_uptime(final_df, start, end)
