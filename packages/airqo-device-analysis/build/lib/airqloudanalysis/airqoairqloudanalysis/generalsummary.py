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


"""# General summary
 This shows the uptime summary of different networks like devices on and off plus the uptime
## All airqloud summary
"""
def create_summary_df(AQData, time_last_post_df, calculate_uptime_df):
    # Ensure AQData is a DataFrame
    if not isinstance(AQData, pd.DataFrame):
        raise ValueError("AQData must be a pandas DataFrame")

    # Merge the DataFrames on 'Device Number' using outer joins
    summary_df = AQData.merge(time_last_post_df[['Device Number', 'Time Difference Flag', 'Time Difference']],
                              on='Device Number', how='outer')
    summary_df = summary_df.merge(calculate_uptime_df[[
        'Device Number',
        'Average Completeness',
        'Average Uptime',
        'Average Sensor Error',
        'Sensor Error',
        'Optimal Completeness',
        'Good Completeness',
        'Fair Completeness',
        'Poor Completeness'
        ]], on='Device Number', how='outer')

    # Extract relevant columns from AQData
    summary_df = summary_df[[
        'Device Number',
        'AirQloud',
        'Average Uptime',
        'Average Sensor Error',
        'Sensor Error',
        'Average Completeness',
        'Optimal Completeness',
        'Good Completeness',
        'Fair Completeness',
        'Poor Completeness',
        'Time Difference Flag',
        'Time Difference'
        ]]

    return summary_df
# summary_df = create_summary_df(AQData, device_time_diff, final_uptime_data)


"""## Off devices"""
# def print_devices_with_time_diff_flag_zero(df, airQlouds, deviceNames):
#     # Check if both lists are empty
#     if len(airQlouds) > 0 and len(deviceNames) > 0:
#       return "airQlouds and deviceNames  can not both have data"

#     # Ensure df is a DataFrame
#     if not isinstance(df, pd.DataFrame):
#         raise ValueError("df must be a pandas DataFrame")

#     # Filter the DataFrame to only include rows where Time Difference Flag is 0
#     filtered_df = df[df['Time Difference Flag'] == 0]

#     if len(airQlouds) > 0:
#       # Group by AirQloud and print the devices
#       for airqloud, group, time_diff in filtered_df.groupby('AirQloud'):
#         print(f"AirQloud: {airqloud}")
#         for device in group['Device Number']:
#             # print(f"  Device Number: {device}")
#             print(f"  Device Number: {device} --> {time_diff}")

#         print("------------------------")
#         print("")

#     elif len(deviceNames) > 0:
#       # Group by AirQloud and print the devices
#       print("Off line devices")
#       for airqloud, group in filtered_df.groupby('Device Number'):
#         for device in group['Device Number']:
#             print(f"  Device Number: {device}")
#         print("")
#     else:
#       return "either airQlouds or deviceNames must have data"
# # print_devices_with_time_diff_flag_zero(summary_df, airQlouds, deviceNames)

def print_devices_with_time_diff_flag_zero_api(df, airQlouds, deviceNames):
    # Check if both lists are populated
    if len(airQlouds) > 0 and len(deviceNames) > 0:
        return "airQlouds and deviceNames cannot both have data"
    # Ensure df is a DataFrame
    if not isinstance(df, pd.DataFrame):
        raise ValueError("df must be a pandas DataFrame")
    # Filter the DataFrame to only include rows where Time Difference Flag is 0
    filtered_df = df[df['Time Difference Flag'] == 0]
    if len(airQlouds) > 0:
        # Filter for specific AirQlouds
        airQloud_filtered_df = filtered_df[filtered_df['AirQloud'].isin(airQlouds)]
        return airQloud_filtered_df[['AirQloud', 'Device Number']].drop_duplicates()
    elif len(deviceNames) > 0:
        # Filter for specific Device Names
        device_filtered_df = filtered_df[filtered_df['Device Number'].isin(deviceNames)]
        return device_filtered_df[['AirQloud', 'Device Number']].drop_duplicates()
    else:
        return "Either airQlouds or deviceNames must have data"
# off_devices = print_devices_with_time_diff_flag_zero_api(summary_df, airQlouds, deviceNames)

"""## CSV export for the summary"""
def export_summary_csv(summary_df, output_file, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
        return "airQlouds and deviceNames cannot both have data"

    # Ensure summary_df is a DataFrame
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError("summary_df must be a pandas DataFrame")

    # Fill NaN values in Average Uptime with 0
    summary_df['Average Uptime'] = summary_df['Average Uptime'].fillna(0)

    # Group by AirQloud or Device Number and calculate the required metrics
    if len(airQlouds) > 0:
        summary_grouped = summary_df.groupby('AirQloud').agg(
            Off=('Time Difference Flag', lambda x: (x == 0).sum()),
            On=('Time Difference Flag', lambda x: (x == 1).sum()),
            Uptime=('Average Uptime', lambda x: round((x.mean() / 24) * 100, 2)),
            Average_Sensor_Error=('Average Sensor Error', lambda x: round(x.mean(), 2)),
            Completeness=('Average Completeness', lambda x: round(x.mean(), 2)),
            Optimal=('Optimal Completeness', 'mean'),
            Good=('Good Completeness', 'mean'),
            Fair=('Fair Completeness', 'mean'),
            Poor=('Poor Completeness', 'mean')
        ).reset_index()

    elif len(deviceNames) > 0:
        summary_grouped = summary_df.groupby('Device Number').agg(
            Uptime=('Average Uptime', lambda x: round((x.mean() / 24) * 100, 2)),
            Off=('Time Difference Flag', lambda x: (x == 0).sum()),
            On=('Time Difference Flag', lambda x: (x == 1).sum()),
            Average_Sensor_Error=('Average Sensor Error', lambda x: round(x.mean(), 2)),
            Completeness=('Average Completeness', lambda x: round(x.mean(), 2)),
            Optimal=('Optimal Completeness', 'mean'),
            Good=('Good Completeness', 'mean'),
            Fair=('Fair Completeness', 'mean'),
            Poor=('Poor Completeness', 'mean')
        ).reset_index()

    else:
        return "Either airQlouds or deviceNames must have data"

    # Calculate the Total Completeness as the sum of means of Optimal, Good, Fair, and Poor
    summary_grouped['Total Completeness'] = (
        summary_grouped['Optimal'] +
        summary_grouped['Good'] +
        summary_grouped['Fair'] +
        summary_grouped['Poor']
    )

    # Convert Optimal, Good, Fair, and Poor to percentages of the Total Completeness
    summary_grouped['Optimal'] = round((summary_grouped['Optimal'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped['Good'] = round((summary_grouped['Good'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped['Fair'] = round((summary_grouped['Fair'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped['Poor'] = round((summary_grouped['Poor'] / summary_grouped['Total Completeness']) * 100, 2)

    summary_grouped = summary_grouped.drop(columns=['Total Completeness'])
    summary_grouped = summary_grouped.rename(columns={
        'Off': 'Devices Off',
        'On': 'Devices On',
        'Completeness': 'Average Hourly Entries',
        'Optimal': 'Optimal Completeness (%)',
        'Good': 'Good Completeness (%)',
        'Fair': 'Fair Completeness (%)',
        'Poor': 'Poor Completeness (%)'
    })
    summary_grouped.fillna(0, inplace=True)

    # Export the summary DataFrame to a CSV file
    summary_grouped.to_csv(output_file, index=False)

    return summary_grouped
# output_file = 'summary.csv'
# summary_grouped = export_summary_csv(summary_df, output_file, airQlouds, deviceNames)

def export_summary_csv_api(summary_df, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"
    # Ensure summary_df is a DataFrame
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError("summary_df must be a pandas DataFrame")
    # Group by AirQloud or device Number and calculate the required metrics
    if len(airQlouds) > 0:
      summary_grouped = summary_df.groupby('AirQloud').agg(
        Off=('Time Difference Flag', lambda x: (x == 0).sum()),
        On=('Time Difference Flag', lambda x: (x == 1).sum()),
        Uptime=('Average Uptime', lambda x: round((x.mean() / 24) * 100, 2)),
        Average_Sensor_Error=('Average Sensor Error', lambda x: round(x.mean(), 2)),
        Completeness=('Average Completeness', lambda x: round(x.mean(), 2)),
        Optimal=('Optimal Completeness', 'mean'),
        Good=('Good Completeness', 'mean'),
        Fair=('Fair Completeness', 'mean'),
        Poor=('Poor Completeness', 'mean')
      ).reset_index()
    elif len(deviceNames) > 0:
      summary_grouped = summary_df.groupby('Device Number').agg(
        Uptime=('Average Uptime', lambda x: round((x.mean() / 24) * 100, 2)),
        Off=('Time Difference Flag', lambda x: (x == 0).sum()),
        On=('Time Difference Flag', lambda x: (x == 1).sum()),
        Average_Sensor_Error=('Average Sensor Error', lambda x: round(x.mean(), 2)),
        Completeness=('Average Completeness', lambda x: round(x.mean(), 2)),
        Optimal=('Optimal Completeness', 'mean'),
        Good=('Good Completeness', 'mean'),
        Fair=('Fair Completeness', 'mean'),
        Poor=('Poor Completeness', 'mean')
      ).reset_index()
    else:
      return "either airQlouds or deviceNames must have data"
    # Calculate the Total Completeness as the sum of means of Optimal, Good, Fair, and Poor
    summary_grouped['Total Completeness'] = (
        summary_grouped['Optimal'] +
        summary_grouped['Good'] +
        summary_grouped['Fair'] +
        summary_grouped['Poor']
    )
    # Convert Optimal, Good, Fair, and Poor to percentages of the Total Completeness
    summary_grouped['Optimal'] = round((summary_grouped['Optimal'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped['Good'] = round((summary_grouped['Good'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped['Fair'] = round((summary_grouped['Fair'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped['Poor'] = round((summary_grouped['Poor'] / summary_grouped['Total Completeness']) * 100, 2)
    summary_grouped = summary_grouped.drop(columns=['Total Completeness'])
    summary_grouped = summary_grouped.rename(columns={
        'Off': 'Devices Off',
        'On': 'Devices On',
        'Completeness': 'Average Hourly Entries',
        'Optimal': 'Optimal Completeness (%)',
        'Good': 'Good Completeness (%)',
        'Fair': 'Fair Completeness (%)',
        'Poor': 'Poor Completeness (%)'
        })
    summary_grouped.fillna(0, inplace=True)
    return summary_grouped
# summary_grouped = export_summary_csv_api(summary_df, airQlouds, deviceNames)

"""## Average device uptime over period"""
def plot_uptime_by_device(summary_df):
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError("summary_df must be a pandas DataFrame")

    # Aggregate by AirQloud and Device Number
    uptime_data = summary_df.groupby(['AirQloud', 'Device Number']).agg(
        Uptime=('Average Uptime', lambda x: round((x.mean() / 24) * 100, 2))
    ).reset_index()

    if uptime_data.empty:
        print("No data available to plot.")
        return

    # Calculate number of rows for 3 columns (ceiling division)
    num_airqlouds = uptime_data['AirQloud'].nunique()
    if num_airqlouds > 0:
        num_rows = (num_airqlouds + 2) // 3
        # Increase minimum height and per-row height multiplier (e.g., to 500)
        # to ensure sufficient space for labels
        height = max(700, num_rows * 500)
    else:
        height = 700

    fig = px.bar(uptime_data, x='Device Number', y='Uptime',
                 facet_col='AirQloud', facet_col_wrap=3,
                 # Increase row spacing to prevent device names from overlapping the plot below
                 facet_row_spacing=0.05,
                 title='Uptime for Devices by AirQloud',
                 labels={'Uptime': 'Uptime (%)', 'Device Number': 'Device Number'},
                 text='Uptime')

    # Update axes to be independent so each subplot only shows its relevant devices
    fig.update_xaxes(matches=None, showticklabels=True)
    fig.update_yaxes(matches=None, showticklabels=True)

    # Adjust layout
    fig.update_layout(height=height, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_uptime_by_device(summary_df)

def plot_uptime_by_device_api(summary_df):
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError("summary_df must be a pandas DataFrame")
    uptime_data = summary_df.groupby('Device Number').agg(
        Uptime=('Average Uptime', lambda x: round((x.mean() / 24) * 100, 2))
    ).reset_index()
    return uptime_data
# uptime_data = plot_uptime_by_device_api(summary_df)

"""## Accuracy Metrics"""
def calculate_accuracy_metrics(df, sensor1_col='Sensor1 PM2.5_CF_1_ug/m3', sensor2_col='Sensor2 PM2.5_CF_1_ug/m3', output_csv=None):
    results = []

    # Check if columns exist in the DataFrame
    if sensor1_col not in df.columns:
        print(f"Error: Sensor 1 column '{sensor1_col}' not found in DataFrame.")
        return pd.DataFrame() 
    if sensor2_col not in df.columns:
        print(f"Error: Sensor 2 column '{sensor2_col}' not found in DataFrame.")
        return pd.DataFrame() 

    for device_number, group in df.groupby('Device Number'):
        # Filter for rows where both sensors have valid (non-null) data
        valid_data = group.dropna(subset=[sensor1_col, sensor2_col])

        if valid_data.empty:
            continue

        s1 = valid_data[sensor1_col]
        # We treat Sensor 2 as the 'reference' for the sake of the formulas
        s2 = valid_data[sensor2_col] 

        # Calculate differences (Sensor 1 - Sensor 2)
        diff = s1 - s2
        abs_diff = diff.abs()

        # Mean Error (ME)
        me = diff.mean()

        # Mean Absolute Error (MAE)
        mae = abs_diff.mean()

        # Root Mean Square Error (RMSE)
        rmse = np.sqrt((diff ** 2).mean())

        # Bias (Same as ME in this context)
        # The equation Bias = 1/n * Sum(S - R) is identical to Mean Error
        bias = me

        # Relative Error (%)
        # Formula: ((S - R) / R) * 100. We use Sensor 2 as R here.
        with np.errstate(divide='ignore', invalid='ignore'):
            rel_error = (diff / s2) * 100
            rel_error = rel_error.replace([np.inf, -np.inf], np.nan)
        
        mean_rel_error = rel_error.mean()

        # Get AirQloud if available
        airqloud = group['AirQloud'].iloc[0] if 'AirQloud' in group.columns else None

        results.append({
            'Device Number': device_number,
            'AirQloud': airqloud,
            'Mean Error': round(me, 2),
            'MAE': round(mae, 2),
            'RMSE': round(rmse, 2),
            'Bias': round(bias, 2),
            'Relative Error (%)': round(mean_rel_error, 2)
        })

    results_df = pd.DataFrame(results)
    
    if output_csv:
        results_df.to_csv(output_csv, index=False)
        print(f"Accuracy metrics saved to {output_csv}")
        
    return results_df
# accuracy_metrics_df = calculate_accuracy_metrics(df, output_csv='accuracy_metrics.csv')



"""## Uptime
### Weekly uptime """
def calculate_daily_uptime_per_device(final_df, AQData, start, end):
    weekly_df, analysis_duration, first_date_in_df, last_date_in_df = create_dates(start, end)

    # Merging the dataframes on 'Device Number'
    final_df = pd.merge(final_df, AQData, on='Device Number', how='right')

    # Filling NaN values with zero
    final_df.fillna(0, inplace=True)

    # Ensure 'created_at' is in datetime format
    # final_df['created_at'] = pd.to_datetime(final_df['created_at'], errors='coerce')
    final_df['created_at'] = pd.to_datetime(final_df['created_at'], errors='coerce', utc=True)

    # Extract date and hour from 'created_at'
    final_df['Date'] = final_df['created_at'].dt.date
    final_df['Hour'] = final_df['created_at'].dt.hour

    # Group by 'Device Number', 'Date', and 'Hour' to calculate hourly uptime
    hourly_uptime = final_df.groupby(['Device Number', 'Date', 'Hour']).size().reset_index(name='Count')

    # Group by 'Device Number' and 'Date' to calculate daily uptime (number of hours with data)
    daily_uptime = hourly_uptime.groupby(['Device Number', 'Date']).size().reset_index(name='Daily Uptime (hours)')

    # Ensure that we have a complete set of dates for each device
    all_devices = final_df['Device Number'].unique()
    date_range = pd.date_range(start=final_df['Date'].min(), end=final_df['Date'].max())

    # Create a MultiIndex from all combinations of devices and dates
    all_index = pd.MultiIndex.from_product([all_devices, date_range], names=['Device Number', 'Date'])

    # Reindex the daily uptime dataframe to include all dates for each device
    daily_uptime = daily_uptime.set_index(['Device Number', 'Date']).reindex(all_index, fill_value=0).reset_index()

    # Filter the data for the specified date range
    start_date = pd.to_datetime(first_date_in_df)
    end_date = pd.to_datetime(last_date_in_df)
    daily_uptime = daily_uptime[(daily_uptime['Date'] >= start_date) & (daily_uptime['Date'] <= end_date)]


    return daily_uptime
# daily_uptime = calculate_daily_uptime_per_device(final_df, AQData, start, end)

def calculate_weekly_average_uptime(final_df, AQData, airQlouds, deviceNames, start, end):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    # Calculate daily uptime per device
    daily_uptime = calculate_daily_uptime_per_device(final_df, AQData, start, end)

    # Convert 'Date' to datetime to extract the week
    daily_uptime['Date'] = pd.to_datetime(daily_uptime['Date'])
    daily_uptime['Week'] = daily_uptime['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    # Merge the daily uptime with the original dataframe to get 'AirQloud'
    merged_df = daily_uptime.merge(final_df[['Device Number', 'AirQloud']].drop_duplicates(), on='Device Number')

    if len(airQlouds) > 0:
      # Group by 'AirQloud' and 'Week' to calculate the weekly average uptime
      weekly_uptime = merged_df.groupby(['AirQloud', 'Week'])['Daily Uptime (hours)'].mean().reset_index(name='Weekly Average Uptime (hours)')

    elif len(deviceNames) > 0:
      # Group by 'Device Number' and 'Week' to calculate the weekly average uptime
      weekly_uptime = merged_df.groupby(['Device Number', 'Week'])['Daily Uptime (hours)'].mean().reset_index(name='Weekly Average Uptime (hours)')
    else:
      return "either airQlouds or deviceNames must have data"

    # Convert the weekly average uptime to a percentage
    weekly_uptime['Weekly Average Uptime (%)'] = (weekly_uptime['Weekly Average Uptime (hours)'] / 24) * 100

    return weekly_uptime
# weekly_average_uptime = calculate_weekly_average_uptime(final_df, AQData, airQlouds, deviceNames, start, end)

def format_weekly_uptime_output(weekly_uptime, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    if len(airQlouds) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_uptime.pivot(index='AirQloud', columns='Week', values='Weekly Average Uptime (%)')

    elif len(deviceNames) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_uptime.pivot(index='Device Number', columns='Week', values='Weekly Average Uptime (%)')

    else:
      return "either airQlouds or deviceNames must have data"

    # Reset the index to make 'AirQloud' a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
# formatted_weekly_uptime = format_weekly_uptime_output(weekly_average_uptime, airQlouds, deviceNames)

def calculate_weekly_average_uptime_per_device(final_df, AQData, start, end):
    # Calculate daily uptime per device
    daily_uptime = calculate_daily_uptime_per_device(final_df, AQData, start, end)

    # Convert 'Date' to datetime to extract the week
    daily_uptime['Date'] = pd.to_datetime(daily_uptime['Date'])
    daily_uptime['Week'] = daily_uptime['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    # Group by 'Device Number' and 'Week' to calculate the weekly average uptime
    weekly_uptime = daily_uptime.groupby(['Device Number', 'Week'])['Daily Uptime (hours)'].mean().reset_index(name='Weekly Average Uptime (hours)')

    # Convert the weekly average uptime to a percentage
    weekly_uptime['Weekly Average Uptime (%)'] = (weekly_uptime['Weekly Average Uptime (hours)'] / 24) * 100

    return weekly_uptime
# weekly_average_uptime_per_device = calculate_weekly_average_uptime_per_device(final_df, AQData, start, end)

def format_weekly_device_uptime_output(weekly_uptime):
    # Pivot the table to get weeks as columns and Device Numbers as rows
    pivot_table = weekly_uptime.pivot(index='Device Number', columns='Week', values='Weekly Average Uptime (%)')

    # Reset the index to make 'Device Number' a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
# formatted_weekly_device_uptime = format_weekly_device_uptime_output(weekly_average_uptime_per_device)

def calculate_daily_average_uptime_per_device(final_df, AQData, start, end):
    # Calculate daily uptime per device
    daily_uptime = calculate_daily_uptime_per_device(final_df, AQData, start, end)

    # Convert the daily uptime to a percentage
    daily_uptime['Daily Uptime (%)'] = (daily_uptime['Daily Uptime (hours)'] / 24) * 100

    return daily_uptime
# daily_average_uptime_per_device = calculate_daily_average_uptime_per_device(final_df, AQData, start, end)

def format_daily_device_uptime_output(daily_uptime):
    # Pivot the table to get dates as columns and Device Numbers as rows
    pivot_table = daily_uptime.pivot(index='Device Number', columns='Date', values='Daily Uptime (%)')

    # Reset the index to make 'Device Number' a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
# formatted_daily_device_uptime = format_daily_device_uptime_output(daily_average_uptime_per_device)


"""### Weekly uptime trends"""
def plot_weekly_uptime(pivot_table, airQlouds, deviceNames):
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    if len(airQlouds) > 0:
      melted_df = pd.melt(pivot_table, id_vars=['AirQloud'], var_name='Week', value_name='Weekly Average Uptime (%)')

      fig = px.bar(melted_df, x='AirQloud', y='Weekly Average Uptime (%)', color='Week',
                 barmode='group', labels={'x': 'AirQloud', 'y': 'Weekly Average Uptime (%)'},
                 title='Weekly Average Uptime (%) per AirQloud',
                 hover_name='AirQloud', hover_data=['Week', 'Weekly Average Uptime (%)'])

    elif len(deviceNames) > 0:
      melted_df = pd.melt(pivot_table, id_vars=['Device Number'], var_name='Week', value_name='Weekly Average Uptime (%)')

      fig = px.bar(melted_df, x='Device Number', y='Weekly Average Uptime (%)', color='Week',
                 barmode='group', labels={'x': 'Device Number', 'y': 'Weekly Average Uptime (%)'},
                 title='Weekly Average Uptime (%) per Device Number',
                 hover_name='Device Number', hover_data=['Week', 'Weekly Average Uptime (%)'])

    else:
      return "either airQlouds or deviceNames must have data"

    fig.update_layout(height=600, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_weekly_uptime(formatted_weekly_uptime, airQlouds, deviceNames)


"""## Sensor error margin
### Weekly sensor  error margin"""
def calculate_daily_error_margin_per_device(df):
    # Ensure 'created_at' is in datetime format
    df['created_at'] = pd.to_datetime(df['created_at'])

    # Calculate the error margin
    df['error_margin'] = np.abs(df['Sensor1 PM2.5_CF_1_ug/m3'] - df['Sensor2 PM2.5_CF_1_ug/m3'])

    # Extract date from 'created_at'
    df['Date'] = df['created_at'].dt.date

    # Group by 'Device Number' and 'Date' to calculate daily error margin
    daily_error_margin = df.groupby(['Device Number', 'Date', 'AirQloud'])['error_margin'].mean().reset_index(name='Daily Error Margin')

    return daily_error_margin
# daily_error_margin = calculate_daily_error_margin_per_device(final_df)

def calculate_weekly_average_error_margin(df, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    # Calculate daily error margin per device
    daily_error_margin = calculate_daily_error_margin_per_device(df)

    # Convert 'Date' to datetime to extract the week
    daily_error_margin['Date'] = pd.to_datetime(daily_error_margin['Date'])
    daily_error_margin['Week'] = daily_error_margin['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    if len(airQlouds) > 0:
      # Group by 'AirQloud' and 'Week' to calculate the weekly average error margin
      weekly_error_margin = daily_error_margin.groupby(['AirQloud', 'Week'])['Daily Error Margin'].mean().reset_index(name='Weekly Average Error Margin')

    elif len(deviceNames) > 0:
      # Group by 'Device Number' and 'Week' to calculate the weekly average error margin
      weekly_error_margin = daily_error_margin.groupby(['Device Number', 'Week'])['Daily Error Margin'].mean().reset_index(name='Weekly Average Error Margin')

    else:
      return "either airQlouds or deviceNames must have data"

    return weekly_error_margin
# weekly_error_margin = calculate_weekly_average_error_margin(final_df, airQlouds, deviceNames)

def format_weekly_error_margin_output(weekly_error_margin, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    if len(airQlouds) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_error_margin.pivot(index='AirQloud', columns='Week', values='Weekly Average Error Margin')

    elif len(deviceNames) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_error_margin.pivot(index='Device Number', columns='Week', values='Weekly Average Error Margin')

    else:
      return "either airQlouds or deviceNames must have data"

    # Reset the index to make 'AirQloud' a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
# formatted_weekly_error_margin = format_weekly_error_margin_output(weekly_error_margin, airQlouds, deviceNames)


"""### Weekly sensor error margin trends"""
def plot_weekly_error(pivot_table, airQlouds, deviceNames):
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    if len(airQlouds) > 0:
      melted_df = pd.melt(pivot_table, id_vars=['AirQloud'], var_name='Week', value_name='Weekly Average Error Margin')

      fig = px.bar(melted_df, x='AirQloud', y='Weekly Average Error Margin', color='Week',
                 barmode='group', labels={'x': 'AirQloud', 'y': 'Weekly Average Error Margin'},
                 title='Weekly Average Error Margin per AirQloud',
                 hover_name='AirQloud', hover_data=['Week', 'Weekly Average Error Margin'])

    elif len(deviceNames) > 0:
      melted_df = pd.melt(pivot_table, id_vars=['Device Number'], var_name='Week', value_name='Weekly Average Error Margin')

      fig = px.bar(melted_df, x='Device Number', y='Weekly Average Error Margin', color='Week',
                 barmode='group', labels={'x': 'Device Number', 'y': 'Weekly Average Error Margin'},
                 title='Weekly Average Error Margin per Device',
                 hover_name='Device Number', hover_data=['Week', 'Weekly Average Error Margin'])

    fig.update_layout(height=600, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_weekly_error(formatted_weekly_error_margin, airQlouds, deviceNames)


"""## Device completeness
### Weekly device completeness"""
def calculate_daily_completeness_per_device(df):
    # Ensure 'created_at' is in datetime format
    df['created_at'] = pd.to_datetime(df['created_at'])

    # Extract date and hour from 'created_at'
    df['Date'] = df['created_at'].dt.date
    df['Hour'] = df['created_at'].dt.hour

    # Group by 'Device Number', 'Date', and 'Hour' to calculate hourly completeness
    hourly_completeness = df.groupby(['Device Number', 'Date', 'Hour']).size().reset_index(name='Count')

    # Group by 'Device Number' and 'Date' to calculate daily completeness (average number of entries per hour)
    daily_completeness = hourly_completeness.groupby(['Device Number', 'Date'])['Count'].mean().reset_index(name='Daily Completeness (entries/hour)')

    return daily_completeness
# daily_completeness = calculate_daily_completeness_per_device(final_df)

def calculate_weekly_average_completeness(df, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    # Calculate daily completeness per device
    daily_completeness = calculate_daily_completeness_per_device(df)

    # Convert 'Date' to datetime to extract the week
    daily_completeness['Date'] = pd.to_datetime(daily_completeness['Date'])
    daily_completeness['Week'] = daily_completeness['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    # Merge the daily completeness with the original dataframe to get 'AirQloud'
    merged_df = daily_completeness.merge(df[['Device Number', 'AirQloud']].drop_duplicates(), on='Device Number')

    if len(airQlouds) > 0:
      # Group by 'AirQloud' and 'Week' to calculate the weekly average completeness
      weekly_completeness = merged_df.groupby(['AirQloud', 'Week'])['Daily Completeness (entries/hour)'].mean().reset_index(name='Weekly Average Completeness (entries/hour)')

    elif len(deviceNames) > 0:
      # Group by 'Device Number' and 'Week' to calculate the weekly average completeness
      weekly_completeness = merged_df.groupby(['Device Number', 'Week'])['Daily Completeness (entries/hour)'].mean().reset_index(name='Weekly Average Completeness (entries/hour)')

    else:
      return "either airQlouds or deviceNames must have data"

    return weekly_completeness
# weekly_completeness = calculate_weekly_average_completeness(final_df, airQlouds, deviceNames)

def format_weekly_completeness_output(weekly_completeness, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
      return "airQlouds and deviceNames  can not both have data"

    if len(airQlouds) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_completeness.pivot(index='AirQloud', columns='Week', values='Weekly Average Completeness (entries/hour)')

    elif len(deviceNames) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_completeness.pivot(index='Device Number', columns='Week', values='Weekly Average Completeness (entries/hour)')

    else:
      return "either airQlouds or deviceNames must have data"

    # Reset the index to make 'AirQloud' a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
# formatted_weekly_completeness = format_weekly_completeness_output(weekly_completeness, airQlouds, deviceNames)


"""### Weekly data completeness trend"""
def plot_weekly_completeness(pivot_table, airQlouds, deviceNames):
    # Check if both lists are empty
    if len(airQlouds) > 0 and len(deviceNames) > 0:
        return "airQlouds and deviceNames cannot both have data"

    if len(airQlouds) > 0:
        melted_df = pd.melt(pivot_table, id_vars=['AirQloud'], var_name='Week', value_name='Weekly Average Completeness (entries/hour)')

        fig = px.bar(melted_df, x='AirQloud', y='Weekly Average Completeness (entries/hour)', color='Week',
                     barmode='group', labels={'x': 'AirQloud', 'y': 'Weekly Average Completeness (entries/hour)'},
                     title='Weekly Average Completeness (entries/hour) per AirQloud',
                     hover_name='AirQloud', hover_data=['Week', 'Weekly Average Completeness (entries/hour)'])

    elif len(deviceNames) > 0:
        melted_df = pd.melt(pivot_table, id_vars=['Device Number'], var_name='Week', value_name='Weekly Average Completeness (entries/hour)')

        fig = px.bar(melted_df, x='Device Number', y='Weekly Average Completeness (entries/hour)', color='Week',
                     barmode='group', labels={'x': 'Device Number', 'y': 'Weekly Average Completeness (entries/hour)'},
                     title='Weekly Average Completeness (entries/hour) per Device',
                     hover_name='Device Number', hover_data=['Week', 'Weekly Average Completeness (entries/hour)'])

    else:
        return "either airQlouds or deviceNames must have data"

    fig.update_layout(height=600, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_weekly_completness(formatted_weekly_completeness, airQlouds, deviceNames)
# Alias for backward compatibility
plot_weekly_completness = plot_weekly_completeness
