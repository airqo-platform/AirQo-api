import json
import numpy as np
from pandas import json_normalize
import requests
import pandas as pd
import time
import glob
import os
from os import read

#Other important libaries for datetime + timezone, OS for interacting with the operating system, requests for sending HTTP requests, BeautifulSoup for web scrapping
#Str to datetime library
from pytz import all_timezones
from datetime import datetime, timedelta
from dateutil import parser
from datetime import date# @title Neccessary libraries
from datetime import datetime
#python libraries needed
from collections import defaultdict

# Data processing libraries
import json
import numpy as np
from pandas import json_normalize
import requests
import pandas as pd
import time

#Other important libaries for datetime + timezone, OS for interacting with the operating system, requests for sending HTTP requests, BeautifulSoup for web scrapping
#Str to datetime library
from pytz import all_timezones
from datetime import datetime, timedelta
from dateutil import parser
from datetime import date
import datetime
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
import datetime
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
munits.registry[datetime.date] = converter


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
        "field1": "Sensor1 PM2.5_CF_1_ug/m3",
        "field2": "Sensor1 PM10_CF_1_ug/m3",
        "field3": "Sensor2 PM2.5_CF_1_ug/m3",
        "field4": "Sensor2 PM10_CF_1_ug/m3",
        "field5": "Latitude",
        "field6": "Longitude",
        "field7": "Battery Voltage"
    })

    # Datetime data preprocessing
    df['created_at'] = pd.to_datetime(df['created_at'].apply(lambda x: parser.parse(x)))  # str to datetime type
    df['Date'] = df['created_at'].dt.date

    # Drop the extra Latitude and Longitude columns as they're not needed for further analysis
    df.drop(['Latitude', 'Longitude'], axis=1, inplace=True)

    # Calculate the mean PM2.5 and PM10 values
    df["Mean PM2.5"] = (df["Sensor1 PM2.5_CF_1_ug/m3"] + df["Sensor2 PM2.5_CF_1_ug/m3"]) / 2
    df["Mean PM10"] = (df["Sensor1 PM10_CF_1_ug/m3"] + df["Sensor2 PM10_CF_1_ug/m3"]) / 2

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
# df, days_between_df_dates, first_date_in_df, last_date_in_df = create_dates(start, end)


"""
Retriving the data by fetching the max number of records at a time
"""
from datetime import datetime
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
        response = requests.get(url)
        data = response.json()

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
def url( ID, key, start, end):
  url = 'https://thingspeak.com/channels/'+str(ID)+'/feeds.json?start='+str(start)+'T00:00:00Z&end='+str(end)+'T23:59:59Z&api_key='+str(key)
  return url
# url(123456, 'ABCD1234', start, end)

#Function to generate the last url for the APIs from thingspeak for the time off functionality
def lastUrl(ID, key):
  lastUrl = 'https://thingspeak.com/channels/' + str(ID) + '/feeds.json?api_key=' + str(key) + '&results=1'
  # lastUrl = 'https://thingspeak.com/channels/' + str(ID) + '/feeds/last.json?api_key=' + str(key)
  return lastUrl
# lastUrl(123456, 'ABCD1234')


"""## DataFrame airqloud formation"""
"""## by API"""
baseApiURL = "https://api.airqo.net/api/v2/devices"

def getDeviceData(token):
  url = f"{baseApiURL}?token={token}"
  response = requests.request("GET", url)
  # print(response.json())
  return response.json()
#getDeviceData("your_token")

def getSiteData(token):
#   url = str(baseApiURL) + "/metadata/grids?token=" + str(token)
  url = str(baseApiURL) + "/grids/summary?token=" + str(token)
  response = requests.request("GET", url)
  # print(response.json())
  return response.json()
#getSiteData("your_token")

def decryptData(token, data):
    url = f"{baseApiURL}/decrypt/bulk?token={token}"

    response = requests.post(url, json=data)

    if response.status_code == 200:
        # print(response.json())
        return response.json()
    else:
        print(f"Error: {response.status_code}, {response.text}")
        return None
#decryptData("your_token", "your_data")

def processSiteData(token):
    # Fetch site data
    site_data = getSiteData(token)

    if site_data.get('success') and 'grids' in site_data:
        grids = site_data['grids']
        data = [{"name": grid["name"], "admin_level": grid["admin_level"]} for grid in grids]

        df = pd.DataFrame(data)
        grouped_df = df.groupby('admin_level').apply(lambda x: x[['name']].reset_index(drop=True))

        return grouped_df
    else:
        print("Error: No grids data available")
        return pd.DataFrame()
#grouped_df=processSiteData("your_token")

def airqloudlist_api(token, airQlouds):
    device_data = getDeviceData(token)

    data_list = []

    if device_data.get("success"):
        devices = device_data.get("devices", [])

        # Process each device  "category": "lowcost",
        for device in devices:
          if device.get("category") == "lowcost" or device.get("category") == None:
            long_name = device.get("long_name")
            device_number = device.get("device_number")
            readKey = device.get("readKey")

            # Process each grid entry within a device
            for grid in device.get("grids", []):
                grid_id = grid.get("_id")
                grid_name = grid.get("name")
                admin_level = grid.get("admin_level")

                for airQloud in airQlouds:
                  if airQloud in grid_name:
                    #AirQloud Append the processed data to the list
                    data_list.append({
                        "Device Number": long_name,
                        "Device ID": str(device_number) if device_number is not None else None,
                        "Read Key": readKey,
                        "grid_id": grid_id,
                        "grid_name": grid_name,
                        "admin_level": admin_level
                    })
    else:
        print("Error fetching device data")

    df = pd.DataFrame(data_list)
    df = df.dropna(subset=["Device ID"])
    df = df.dropna(subset=["Read Key"])

    # Data encryption
    encryption_data = []
    for _, row in df.iterrows():
        encryption_data.append({
            "encrypted_key": row["Read Key"],
            "device_number": int(row["Device ID"])
        })

    # Decrypt the read keys
    decrypted_data = decryptData(token, encryption_data)

    if decrypted_data and decrypted_data.get('decrypted_keys'):
        decrypted_keys = [decrypted.get('decrypted_key') for decrypted in decrypted_data['decrypted_keys']]

        if len(decrypted_keys) == len(df):
            df["Decrypted Read Key"] = decrypted_keys
        else:
            print("Mismatch between decrypted keys and DataFrame length")

    df = df.drop(columns=["Read Key"])
    df = df.rename(columns={"Decrypted Read Key": "Read Key", "grid_name":"AirQloud", "grid_id" : "AirQloud ID", "admin_level" : "AirQloud Type"})

    return df
# df = airqloudlist_api(token)

"""## by google drive"""
def airqloudlist(filepath, excelfile, airQlouds, deviceNames):
  dfs = []
  # Check if both lists are empty
  if len(airQlouds) > 0 and len(deviceNames) > 0:
    return "airQlouds and deviceNames  can not both have data"

  # Check if either list is empty
  if len(airQlouds) > 0:
    for sheet_name in excelfile.sheet_names:
      for AirQloud in airQlouds: 
        if sheet_name == AirQloud:
          df = pd.read_excel(filepath, sheet_name=sheet_name)
          df['AirQloud'] = sheet_name
          df = df[['Device Number', 'Read Key', 'Device ID', 'AirQloud']]
          df = df.astype({'Device Number': str, 'Read Key': str, 'Device ID': str, 'AirQloud': str})
          dfs.append(df)

    AQData = pd.concat(dfs, ignore_index=True)
    return AQData

  elif len(deviceNames) > 0:
    for sheet_name in excelfile.sheet_names:
      df = pd.read_excel(filepath, sheet_name=sheet_name)
      df['AirQloud'] = sheet_name
      df = df[['Device Number', 'Read Key', 'Device ID', 'AirQloud']]
      df = df.astype({'Device Number': str, 'Read Key': str, 'Device ID': str, 'AirQloud': str})
      dfs.append(df)

    AQData = pd.concat(dfs, ignore_index=True)
    # Create a new DataFrame to store the filtered rows
    filtered_data = []
    for index, row in AQData.iterrows():
      deviceNumber = row['Device Number']
      if deviceNumber in deviceNames: # Check if the device number is in the list of device names
        filtered_data.append(row)
    # Create a DataFrame from the filtered rows
    AQData = pd.DataFrame(filtered_data)
    return AQData
  else:
    return "either airQlouds or deviceNames must have data"
# AQData = airqloudlist(file_path, excel_file, airQlouds, deviceNames)


"""## initializing dataframe"""
def process_data(df, start, end):
    all_data = []  # List to store data for all devices

    for index, row in df.iterrows():
        deviceNumber = row['Device Number']
        readKey = row['Read Key']
        deviceID = row['Device ID']
        deviceDataFrame = pd.DataFrame()  # Initialize an empty DataFrame for each device

        # Fetch the raw data for this device
        raw_data = fetch_all_records(deviceID, readKey, start, end)

        # Preprocess the data
        if raw_data.empty:
            print(f"No data found for Device Number {deviceNumber}")
            continue  # Skip empty datasets

        # Preprocessing the raw data
        deviceDataFrame = preprocessing(raw_data)

        # Check if deviceDataFrame is not empty
        if not deviceDataFrame.empty:
            # Add Device Number as a column
            deviceDataFrame['Device Number'] = deviceNumber
            all_data.append(deviceDataFrame)  # Append the processed data to the list
            print("Done", deviceNumber)
        else:
            print(f"No valid data for Device Number {deviceNumber}")

    # Concatenate all device data into one DataFrame
    if all_data:
        final_df = pd.concat(all_data, ignore_index=True)
    else:
        final_df = pd.DataFrame()  # If all_data is empty, return an empty DataFrame

    # Merge with the original AQData based on 'Device Number'
    if not final_df.empty:
        final_df = pd.merge(final_df, df, on=['Device Number'], how='left')
    else:
        print("Final DataFrame is empty after concatenation.")

    return final_df
# final_df = process_data(AQData, start, end)

def process_data_function(df, startdate, enddate, airqlouds_csv):
    additional_data = []

    for airqloud in df['AirQloud'].unique():
        airqloud_df = df[df['AirQloud'] == airqloud]
        airqloud_name = f"*{airqloud}*"
        matching_file = glob.glob(os.path.join(airqlouds_csv, airqloud_name))
        
        if matching_file:
            existing_data = pd.read_csv(matching_file[0])
            existing_start = existing_data['Date'].min()
            existing_end = existing_data['Date'].max()

            # dates are aligned with the existing data
            if existing_start == startdate and existing_end == enddate:
                return existing_data

            # data starts after startdate and ends after enddate
            if startdate > existing_start and enddate > existing_end:
                new_data = process_data(airqloud_df, existing_end, enddate)
                additional_data.append(new_data)
                updated_data = pd.concat([existing_data, new_data])

            # data starts before startdate and ends before enddate    
            elif startdate < existing_start and enddate < existing_end:
                new_data = process_data(airqloud_df, startdate, existing_start)
                additional_data.append(new_data)
                updated_data = pd.concat([existing_data, new_data])

            # data starts after startdate and ends before enddate
            elif startdate > existing_start and enddate < existing_end:
                new_data_start = process_data(airqloud_df, existing_end, enddate)
                new_data_end = process_data(airqloud_df, startdate, existing_start)
                additional_data.extend([new_data_start, new_data_end])
                updated_data = pd.concat([new_data_start, existing_data, new_data_end])

            # data starts before startdate and ends after enddate
            elif startdate < existing_start and enddate > existing_end:
                pass

            finaldf = pd.concat([existing_data] + additional_data) if additional_data else existing_data
            # get the data in the range of the startdate and enddate
            finaldf = finaldf[(finaldf['Date'] >= startdate) & (finaldf['Date'] <= enddate)]

# def process_data_function(df, startdate, enddate, airqlouds_csv):
#     #  for deviceNumber in df['Device Number'].unique():
#     for airqloud in df['AirQloud'].unique():
#         filename = f"{airqlouds_csv}/{startdate}_{enddate}_{airqloud}.csv"
#         try:
#             existing_data = pd.read_csv(filename)
#             existing_start = existing_data['Date'].min()
#             existing_end = existing_data['Date'].max()

#             if existing_start == startdate and existing_end == enddate:
#                 return existing_data

#             additional_data = []

#             if startdate > existing_start and enddate > existing_end:
#                 new_data = process_data(df, existing_end, enddate)
#                 additional_data.append(new_data)
#                 updated_data = pd.concat([existing_data, new_data])


# def process_data_function(df, startdate, enddate, airqloud):
#     filename = f"/content/drive/MyDrive/{startdate}_{enddate}_{airqloud}.csv"
    
#     try:
#         existing_data = pd.read_csv(filename)
#         existing_start = existing_data['timestamp'].min()
#         existing_end = existing_data['timestamp'].max()
        
#         if existing_start == startdate and existing_end == enddate:
#             return existing_data  # Return as DataFrame
        
#         additional_data = []
        
#         if startdate > existing_start and enddate > existing_end:
#             new_data = fetch_data(existing_end, enddate, airqloud)
#             additional_data.append(new_data)
#             new_filename = f"/content/drive/MyDrive/{startdate}_{enddate}_{airqloud}.csv"
#             updated_data = pd.concat([existing_data, new_data])
#             updated_data.to_csv(new_filename, index=False)
        
#         elif startdate < existing_start and enddate < existing_end:
#             new_data = fetch_data(startdate, existing_start, airqloud)
#             additional_data.append(new_data)
#             new_filename = f"/content/drive/MyDrive/{startdate}_{enddate}_{airqloud}.csv"
#             updated_data = pd.concat([new_data, existing_data])
#             updated_data.to_csv(new_filename, index=False)
        
#         elif startdate > existing_start and enddate < existing_end:
#             new_data_start = fetch_data(existing_end, enddate, airqloud)
#             new_data_end = fetch_data(startdate, existing_start, airqloud)
#             additional_data.extend([new_data_start, new_data_end])
#             new_filename = f"/content/drive/MyDrive/{startdate}_{enddate}_{airqloud}.csv"
#             updated_data = pd.concat([new_data_start, existing_data, new_data_end])
#             updated_data.to_csv(new_filename, index=False)
        
#         elif startdate < existing_start and enddate > existing_end:
#             pass  # No action needed
        
#         return pd.concat([existing_data] + additional_data) if additional_data else existing_data
#     except FileNotFoundError:
#         new_data = fetch_data(startdate, enddate, airqloud)
#         new_data.to_csv(filename, index=False)
#         return new_data


"""## Device time off"""
def timeLastPost(df):
    results = []
    for index, row in df.iterrows():
        deviceNumber = row['Device Number']
        readKey = row['Read Key']
        deviceID = row['Device ID']
        airqloud = row['AirQloud']
        last = lastUrl(deviceID, readKey)

        # Fetch data from the API
        try:
            lastData = requests.get(last)
            lastData = lastData.json()
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            print(f"Error fetching data for Device ID {deviceID}: {e}")
            continue  # Skip to the next row

        # Check if 'feeds' exists and is not empty
        if 'feeds' not in lastData or not lastData['feeds']:
            print(f"No data found in feeds for Device ID {deviceID}")
            continue  # Skip to the next row

        # Extract and parse the created_at timestamp
        created_at_str = lastData['feeds'][0]['created_at']
        created_at = datetime.strptime(created_at_str, '%Y-%m-%dT%H:%M:%SZ')

        current_time = datetime.utcnow()
        time_difference = current_time - created_at
        time_diff_flag = 1 if time_difference < timedelta(days=1) else 0


        results.append({
            'Device Number': deviceNumber,
            'Time Difference Flag': time_diff_flag,
            'Time Difference': time_difference,
            'AirQloud': airqloud
        })

    result_df = pd.DataFrame(results)
    return result_df
# device_time_diff = timeLastPost(AQData)

def onlineDeviceList(df):
    # Filter the DataFrame to only include rows where Time Difference Flag is 1
    filtered_df = df[df['Time Difference Flag'] == 1]

    return filtered_df

def offlineDeviceList(df):
    # Filter the DataFrame to only include rows where Time Difference Flag is 0
    filtered_df = df[df['Time Difference Flag'] == 0]

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
    for deviceNumber in df['Device Number'].unique():
        # Filter data for the current device
        device_df = df[df['Device Number'] == deviceNumber]

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
        # error = magnitude('Sensor1 PM2.5_CF_1_ug/m3' - 'Sensor2 PM2.5_CF_1_ug/m3')
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
        device_list.append(deviceNumber)
        airqloud_list.append(device_df['AirQloud'].iloc[0])
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
        'Device Number': device_list,
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
# final_uptime_data = calculate_uptime(final_df, start, end)
