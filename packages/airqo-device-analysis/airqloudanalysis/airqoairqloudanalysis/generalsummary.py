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
#python libraries needed
from collections import defaultdict

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


device_number_literal = 'Device Number'
air_qloud_literal = 'AirQloud'
average_uptime_literal = 'Average Uptime'
average_sensor_error_literal = 'Average Sensor Error'
sensor_error_literal = 'Sensor Error'
average_completeness_literal = 'Average Completeness'
optimal_completeness_literal = 'Optimal Completeness'
good_completeness_literal = 'Good Completeness'
fair_completeness_literal = 'Fair Completeness'
poor_completeness_literal = 'Poor Completeness'
time_difference_flag_literal = 'Time Difference Flag'
time_difference_literal = 'Time Difference'
air_qlouds_and_device_names_error = "air_qlouds and device_names  can not both have data"
summary_df_must_be_a_pandas_dataframe_error = "summary_df must be a pandas DataFrame"
total_completeness_literal = 'Total Completeness'
either_air_qlouds_or_device_names_must_have_data_error = "either air_qlouds or device_names must have data"
daily_uptime_hours_literal = 'Daily Uptime (hours)'
weekly_average_completeness_literal = 'Weekly Average Completeness (entries/hour)'
daily_completeness_entries_hour_literal = 'Daily Completeness (entries/hour)'
weekly_average_error_margin_literal = 'Weekly Average Error Margin'
daily_error_margin_literal = 'Daily Error Margin'
weekly_average_uptime_literal = 'Weekly Average Uptime (%)'
weekly_average_uptime_hours_literal = 'Weekly Average Uptime (hours)'


"""# General summary
 This shows the uptime summary of different networks like devices on and off plus the uptime
## All airqloud summary
"""
def create_summary_df(aq_data, time_last_post_df, calculate_uptime_df):
    # Ensure aq_data is a DataFrame
    if not isinstance(aq_data, pd.DataFrame):
        raise ValueError("aq_data must be a pandas DataFrame")

    # Merge the DataFrames on device_number_literal using outer joins
    summary_df = aq_data.merge(time_last_post_df[[device_number_literal, time_difference_flag_literal, time_difference_literal]],
                              on=device_number_literal, how='outer')
    summary_df = summary_df.merge(calculate_uptime_df[[
        device_number_literal,
        average_completeness_literal,
        average_uptime_literal,
        average_sensor_error_literal,
        sensor_error_literal,
        optimal_completeness_literal,
        good_completeness_literal,
        fair_completeness_literal,
        poor_completeness_literal
        ]], on=device_number_literal, how='outer')

    # Extract relevant columns from aq_data
    summary_df = summary_df[[
        device_number_literal,
        air_qloud_literal,
        average_uptime_literal,
        average_sensor_error_literal,
        sensor_error_literal,
        average_completeness_literal,
        optimal_completeness_literal,
        good_completeness_literal,
        fair_completeness_literal,
        poor_completeness_literal,
        time_difference_flag_literal,
        time_difference_literal
        ]]

    return summary_df
#this is sample code:  summary_df = create_summary_df(aq_data, device_time_diff, final_uptime_data)

def print_devices_with_time_diff_flag_zero_api(df, air_qlouds, device_names):
    # Check if both lists are populated
    if len(air_qlouds) > 0 and len(device_names) > 0:
        return air_qlouds_and_device_names_error
    # Ensure df is a DataFrame
    if not isinstance(df, pd.DataFrame):
        raise ValueError("df must be a pandas DataFrame")
    # Filter the DataFrame to only include rows where Time Difference Flag is 0
    filtered_df = df[df[time_difference_flag_literal] == 0]
    if len(air_qlouds) > 0:
        # Filter for specific AirQlouds
        air_qloud_filtered_df = filtered_df[filtered_df[air_qloud_literal].isin(air_qlouds)]
        return air_qloud_filtered_df[[air_qloud_literal, device_number_literal]].drop_duplicates()
    elif len(device_names) > 0:
        # Filter for specific Device Names
        device_filtered_df = filtered_df[filtered_df[device_number_literal].isin(device_names)]
        return device_filtered_df[[air_qloud_literal, device_number_literal]].drop_duplicates()
    else:
        return "Either air_qlouds or device_names must have data"
#this is sample code:  off_devices = print_devices_with_time_diff_flag_zero_api(summary_df, air_qlouds, device_names)

"""## CSV export for the summary"""
def export_summary_csv(summary_df, output_file, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
        return air_qlouds_and_device_names_error

    # Ensure summary_df is a DataFrame
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError(summary_df_must_be_a_pandas_dataframe_error)

    # Fill NaN values in Average Uptime with 0
    summary_df[average_uptime_literal] = summary_df[average_uptime_literal].fillna(0)

    # Filter to only the requested air_qlouds or device_names before aggregating
    if len(air_qlouds) > 0:
        filtered_df = summary_df[summary_df[air_qloud_literal].isin(air_qlouds)]
    elif len(device_names) > 0:
        filtered_df = summary_df[summary_df[device_number_literal].isin(device_names)]
    else:
        filtered_df = summary_df

    # Group by AirQloud or Device Number and calculate the required metrics
    if len(air_qlouds) > 0:
        summary_grouped = filtered_df.groupby(air_qloud_literal).agg(
            Off=(time_difference_flag_literal, lambda x: (x == 0).sum()),
            On=(time_difference_flag_literal, lambda x: (x == 1).sum()),
            Uptime=(average_uptime_literal, lambda x: round((x.mean() / 24) * 100, 2)),
            Average_Sensor_Error=(average_sensor_error_literal, lambda x: round(x.mean(), 2)),
            Completeness=(average_completeness_literal, lambda x: round(x.mean(), 2)),
            Optimal=(optimal_completeness_literal, 'mean'),
            Good=(good_completeness_literal, 'mean'),
            Fair=(fair_completeness_literal, 'mean'),
            Poor=(poor_completeness_literal, 'mean')
        ).reset_index()

    elif len(device_names) > 0:
        summary_grouped = filtered_df.groupby(device_number_literal).agg(
            Uptime=(average_uptime_literal, lambda x: round((x.mean() / 24) * 100, 2)),
            Off=(time_difference_flag_literal, lambda x: (x == 0).sum()),
            On=(time_difference_flag_literal, lambda x: (x == 1).sum()),
            Average_Sensor_Error=(average_sensor_error_literal, lambda x: round(x.mean(), 2)),
            Completeness=(average_completeness_literal, lambda x: round(x.mean(), 2)),
            Optimal=(optimal_completeness_literal, 'mean'),
            Good=(good_completeness_literal, 'mean'),
            Fair=(fair_completeness_literal, 'mean'),
            Poor=(poor_completeness_literal, 'mean')
        ).reset_index()

    else:
        return "Either air_qlouds or device_names must have data"

    # Calculate the Total Completeness as the sum of means of Optimal, Good, Fair, and Poor
    summary_grouped[total_completeness_literal] = (
        summary_grouped['Optimal'] +
        summary_grouped['Good'] +
        summary_grouped['Fair'] +
        summary_grouped['Poor']
    )

    # Convert Optimal, Good, Fair, and Poor to percentages of the Total Completeness
    summary_grouped['Optimal'] = round((summary_grouped['Optimal'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped['Good'] = round((summary_grouped['Good'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped['Fair'] = round((summary_grouped['Fair'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped['Poor'] = round((summary_grouped['Poor'] / summary_grouped[total_completeness_literal]) * 100, 2)

    summary_grouped = summary_grouped.drop(columns=[total_completeness_literal])
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
#this is sample code:  output_file = 'summary.csv'
# summary_grouped = export_summary_csv(summary_df, output_file, air_qlouds, device_names)

def export_summary_csv_api(summary_df, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error
    # Ensure summary_df is a DataFrame
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError(summary_df_must_be_a_pandas_dataframe_error)
    # Filter to only the requested air_qlouds or device_names before aggregating
    if len(air_qlouds) > 0:
        filtered_df = summary_df[summary_df[air_qloud_literal].isin(air_qlouds)]
    elif len(device_names) > 0:
        filtered_df = summary_df[summary_df[device_number_literal].isin(device_names)]
    else:
        filtered_df = summary_df
    # Group by AirQloud or device Number and calculate the required metrics
    if len(air_qlouds) > 0:
      summary_grouped = filtered_df.groupby(air_qloud_literal).agg(
        Off=(time_difference_flag_literal, lambda x: (x == 0).sum()),
        On=(time_difference_flag_literal, lambda x: (x == 1).sum()),
        Uptime=(average_uptime_literal, lambda x: round((x.mean() / 24) * 100, 2)),
        Average_Sensor_Error=(average_sensor_error_literal, lambda x: round(x.mean(), 2)),
        Completeness=(average_completeness_literal, lambda x: round(x.mean(), 2)),
        Optimal=(optimal_completeness_literal, 'mean'),
        Good=(good_completeness_literal, 'mean'),
        Fair=(fair_completeness_literal, 'mean'),
        Poor=(poor_completeness_literal, 'mean')
      ).reset_index()
    elif len(device_names) > 0:
      summary_grouped = filtered_df.groupby(device_number_literal).agg(
        Uptime=(average_uptime_literal, lambda x: round((x.mean() / 24) * 100, 2)),
        Off=(time_difference_flag_literal, lambda x: (x == 0).sum()),
        On=(time_difference_flag_literal, lambda x: (x == 1).sum()),
        Average_Sensor_Error=(average_sensor_error_literal, lambda x: round(x.mean(), 2)),
        Completeness=(average_completeness_literal, lambda x: round(x.mean(), 2)),
        Optimal=(optimal_completeness_literal, 'mean'),
        Good=(good_completeness_literal, 'mean'),
        Fair=(fair_completeness_literal, 'mean'),
        Poor=(poor_completeness_literal, 'mean')
      ).reset_index()
    else:
      return either_air_qlouds_or_device_names_must_have_data_error
    # Calculate the Total Completeness as the sum of means of Optimal, Good, Fair, and Poor
    summary_grouped[total_completeness_literal] = (
        summary_grouped['Optimal'] +
        summary_grouped['Good'] +
        summary_grouped['Fair'] +
        summary_grouped['Poor']
    )
    # Convert Optimal, Good, Fair, and Poor to percentages of the Total Completeness
    summary_grouped['Optimal'] = round((summary_grouped['Optimal'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped['Good'] = round((summary_grouped['Good'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped['Fair'] = round((summary_grouped['Fair'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped['Poor'] = round((summary_grouped['Poor'] / summary_grouped[total_completeness_literal]) * 100, 2)
    summary_grouped = summary_grouped.drop(columns=[total_completeness_literal])
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
#this is sample code:  summary_grouped = export_summary_csv_api(summary_df, air_qlouds, device_names)

"""## Average device uptime over period"""
def plot_uptime_by_device(summary_df):
    if not isinstance(summary_df, pd.DataFrame):
        raise ValueError(summary_df_must_be_a_pandas_dataframe_error)

    # Aggregate by AirQloud and Device Number
    uptime_data = summary_df.groupby([air_qloud_literal, device_number_literal]).agg(
        Uptime=(average_uptime_literal, lambda x: round((x.mean() / 24) * 100, 2))
    ).reset_index()

    if uptime_data.empty:
        print("No data available to plot.")
        return

    # Calculate number of rows for 3 columns (ceiling division)
    num_airqlouds = uptime_data[air_qloud_literal].nunique()
    if num_airqlouds > 0:
        num_rows = (num_airqlouds + 2) // 3
        # Increase minimum height and per-row height multiplier (e.g., to 500)
        # to ensure sufficient space for labels
        height = max(700, num_rows * 500)
    else:
        height = 700

    fig = px.bar(uptime_data, x=device_number_literal, y='Uptime',
                 facet_col=air_qloud_literal, facet_col_wrap=3,
                 # Increase row spacing to prevent device names from overlapping the plot below
                 facet_row_spacing=0.05,
                 title='Uptime for Devices by AirQloud',
                 labels={'Uptime': 'Uptime (%)', device_number_literal: device_number_literal},
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
        raise ValueError(summary_df_must_be_a_pandas_dataframe_error)
    uptime_data = summary_df.groupby(device_number_literal).agg(
        Uptime=(average_uptime_literal, lambda x: round((x.mean() / 24) * 100, 2))
    ).reset_index()
    return uptime_data
#this is sample code:  uptime_data = plot_uptime_by_device_api(summary_df)

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

    for device_number, group in df.groupby(device_number_literal):
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
        airqloud = group[air_qloud_literal].iloc[0] if air_qloud_literal in group.columns else None

        results.append({
            device_number_literal: device_number,
            air_qloud_literal: airqloud,
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
#this is sample code:  accuracy_metrics_df = calculate_accuracy_metrics(df, output_csv='accuracy_metrics.csv')



"""## Uptime
### Weekly uptime """
def calculate_daily_uptime_per_device(final_df, aq_data, start, end):
    weekly_df, analysis_duration, first_date_in_df, last_date_in_df = create_dates(start, end)

    # Merging the dataframes on device_number_literal
    final_df = pd.merge(final_df, aq_data, on=device_number_literal, how='right')

    # Filling NaN values with zero for numeric/measurement columns only;
    # 'created_at' is intentionally excluded so it stays NaT after conversion
    # and does not produce a spurious 1970-01-01 epoch date.
    numeric_cols = final_df.select_dtypes(include='number').columns.tolist()
    final_df[numeric_cols] = final_df[numeric_cols].fillna(0)

    # Ensure 'created_at' is in datetime format
    # final_df['created_at'] = pd.to_datetime(final_df['created_at'], errors='coerce')
    final_df['created_at'] = pd.to_datetime(final_df['created_at'], errors='coerce', utc=True)

    # Extract date and hour from 'created_at'
    final_df['Date'] = final_df['created_at'].dt.date
    final_df['Hour'] = final_df['created_at'].dt.hour

    # Group by device_number_literal, 'Date', and 'Hour' to calculate hourly uptime
    hourly_uptime = final_df.groupby([device_number_literal, 'Date', 'Hour']).size().reset_index(name='Count')

    # Group by device_number_literal and 'Date' to calculate daily uptime (number of hours with data)
    daily_uptime = hourly_uptime.groupby([device_number_literal, 'Date']).size().reset_index(name=daily_uptime_hours_literal)

    # Ensure that we have a complete set of dates for each device
    all_devices = final_df[device_number_literal].unique()
    # Use dropna() so that NaT rows (missing created_at) do not extend the range to 1970-01-01
    valid_dates = final_df['Date'].dropna()
    date_range = pd.date_range(start=valid_dates.min(), end=valid_dates.max())

    # Create a MultiIndex from all combinations of devices and dates
    all_index = pd.MultiIndex.from_product([all_devices, date_range], names=[device_number_literal, 'Date'])

    # Reindex the daily uptime dataframe to include all dates for each device
    daily_uptime = daily_uptime.set_index([device_number_literal, 'Date']).reindex(all_index, fill_value=0).reset_index()

    # Filter the data for the specified date range
    start_date = pd.to_datetime(first_date_in_df)
    end_date = pd.to_datetime(last_date_in_df)
    daily_uptime = daily_uptime[(daily_uptime['Date'] >= start_date) & (daily_uptime['Date'] <= end_date)]


    return daily_uptime
#this is sample code:  daily_uptime = calculate_daily_uptime_per_device(final_df, aq_data, start, end)

def calculate_weekly_average_uptime(final_df, aq_data, air_qlouds, device_names, start, end):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    # Calculate daily uptime per device
    daily_uptime = calculate_daily_uptime_per_device(final_df, aq_data, start, end)

    # Convert 'Date' to datetime to extract the week
    daily_uptime['Date'] = pd.to_datetime(daily_uptime['Date'])
    daily_uptime['Week'] = daily_uptime['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    # Merge the daily uptime with the original dataframe to get air_qloud_literal
    merged_df = daily_uptime.merge(final_df[[device_number_literal, air_qloud_literal]].drop_duplicates(), on=device_number_literal)

    if len(air_qlouds) > 0:
      # Group by air_qloud_literal and 'Week' to calculate the weekly average uptime
      weekly_uptime = merged_df.groupby([air_qloud_literal, 'Week'])[daily_uptime_hours_literal].mean().reset_index(name=weekly_average_uptime_hours_literal)

    elif len(device_names) > 0:
      # Group by device_number_literal and 'Week' to calculate the weekly average uptime
      weekly_uptime = merged_df.groupby([device_number_literal, 'Week'])[daily_uptime_hours_literal].mean().reset_index(name=weekly_average_uptime_hours_literal)
    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    # Convert the weekly average uptime to a percentage
    weekly_uptime[weekly_average_uptime_literal] = (weekly_uptime[weekly_average_uptime_hours_literal] / 24) * 100

    return weekly_uptime
#this is sample code:  weekly_average_uptime = calculate_weekly_average_uptime(final_df, aq_data, air_qlouds, device_names, start, end)

def format_weekly_uptime_output(weekly_uptime, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    if len(air_qlouds) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_uptime.pivot(index=air_qloud_literal, columns='Week', values=weekly_average_uptime_literal)

    elif len(device_names) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_uptime.pivot(index=device_number_literal, columns='Week', values=weekly_average_uptime_literal)

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    # Reset the index to make air_qloud_literal a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
#this is sample code:  formatted_weekly_uptime = format_weekly_uptime_output(weekly_average_uptime, air_qlouds, device_names)

def calculate_weekly_average_uptime_per_device(final_df, aq_data, start, end):
    # Calculate daily uptime per device
    daily_uptime = calculate_daily_uptime_per_device(final_df, aq_data, start, end)

    # Convert 'Date' to datetime to extract the week
    daily_uptime['Date'] = pd.to_datetime(daily_uptime['Date'])
    daily_uptime['Week'] = daily_uptime['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    # Group by device_number_literal and 'Week' to calculate the weekly average uptime
    weekly_uptime = daily_uptime.groupby([device_number_literal, 'Week'])[daily_uptime_hours_literal].mean().reset_index(name=weekly_average_uptime_hours_literal)

    # Convert the weekly average uptime to a percentage
    weekly_uptime[weekly_average_uptime_literal] = (weekly_uptime[weekly_average_uptime_hours_literal] / 24) * 100

    return weekly_uptime
#this is sample code:  weekly_average_uptime_per_device = calculate_weekly_average_uptime_per_device(final_df, aq_data, start, end)

def format_weekly_device_uptime_output(weekly_uptime):
    # Pivot the table to get weeks as columns and Device Numbers as rows
    pivot_table = weekly_uptime.pivot(index=device_number_literal, columns='Week', values=weekly_average_uptime_literal)

    # Reset the index to make device_number_literal a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
#this is sample code:  formatted_weekly_device_uptime = format_weekly_device_uptime_output(weekly_average_uptime_per_device)

def calculate_daily_average_uptime_per_device(final_df, aq_data, start, end):
    # Calculate daily uptime per device
    daily_uptime = calculate_daily_uptime_per_device(final_df, aq_data, start, end)

    # Convert the daily uptime to a percentage
    daily_uptime['Daily Uptime (%)'] = (daily_uptime[daily_uptime_hours_literal] / 24) * 100

    return daily_uptime
#this is sample code:  daily_average_uptime_per_device = calculate_daily_average_uptime_per_device(final_df, aq_data, start, end)

def format_daily_device_uptime_output(daily_uptime):
    # Pivot the table to get dates as columns and Device Numbers as rows
    pivot_table = daily_uptime.pivot(index=device_number_literal, columns='Date', values='Daily Uptime (%)')

    # Reset the index to make device_number_literal a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
#this is sample code:  formatted_daily_device_uptime = format_daily_device_uptime_output(daily_average_uptime_per_device)


"""### Weekly uptime trends"""
def plot_weekly_uptime(pivot_table, air_qlouds, device_names):
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    if len(air_qlouds) > 0:
      melted_df = pd.melt(pivot_table, id_vars=[air_qloud_literal], var_name='Week', value_name=weekly_average_uptime_literal)

      fig = px.bar(melted_df, x=air_qloud_literal, y=weekly_average_uptime_literal, color='Week',
                 barmode='group', labels={'x': air_qloud_literal, 'y': weekly_average_uptime_literal},
                 title='Weekly Average Uptime (%) per AirQloud',
                 hover_name=air_qloud_literal, hover_data=['Week', weekly_average_uptime_literal])

    elif len(device_names) > 0:
      melted_df = pd.melt(pivot_table, id_vars=[device_number_literal], var_name='Week', value_name=weekly_average_uptime_literal)

      fig = px.bar(melted_df, x=device_number_literal, y=weekly_average_uptime_literal, color='Week',
                 barmode='group', labels={'x': device_number_literal, 'y': weekly_average_uptime_literal},
                 title='Weekly Average Uptime (%) per Device Number',
                 hover_name=device_number_literal, hover_data=['Week', weekly_average_uptime_literal])

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    fig.update_layout(height=600, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_weekly_uptime(formatted_weekly_uptime, air_qlouds, device_names)


"""## Sensor error margin
### Weekly sensor  error margin"""
def calculate_daily_error_margin_per_device(df):
    # Ensure 'created_at' is in datetime format
    df['created_at'] = pd.to_datetime(df['created_at'])

    # Calculate the error margin
    df['error_margin'] = np.abs(df['Sensor1 PM2.5_CF_1_ug/m3'] - df['Sensor2 PM2.5_CF_1_ug/m3'])

    # Extract date from 'created_at'
    df['Date'] = df['created_at'].dt.date

    # Group by device_number_literal and 'Date' to calculate daily error margin
    daily_error_margin = df.groupby([device_number_literal, 'Date', air_qloud_literal])['error_margin'].mean().reset_index(name=daily_error_margin_literal)

    return daily_error_margin
#this is sample code:  daily_error_margin = calculate_daily_error_margin_per_device(final_df)

def calculate_weekly_average_error_margin(df, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    # Calculate daily error margin per device
    daily_error_margin = calculate_daily_error_margin_per_device(df)

    # Convert 'Date' to datetime to extract the week
    daily_error_margin['Date'] = pd.to_datetime(daily_error_margin['Date'])
    daily_error_margin['Week'] = daily_error_margin['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    if len(air_qlouds) > 0:
      # Group by air_qloud_literal and 'Week' to calculate the weekly average error margin
      weekly_error_margin = daily_error_margin.groupby([air_qloud_literal, 'Week'])[daily_error_margin_literal].mean().reset_index(name=weekly_average_error_margin_literal)

    elif len(device_names) > 0:
      # Group by device_number_literal and 'Week' to calculate the weekly average error margin
      weekly_error_margin = daily_error_margin.groupby([device_number_literal, 'Week'])[daily_error_margin_literal].mean().reset_index(name=weekly_average_error_margin_literal)

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    return weekly_error_margin
#this is sample code:  weekly_error_margin = calculate_weekly_average_error_margin(final_df, air_qlouds, device_names)

def format_weekly_error_margin_output(weekly_error_margin, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    if len(air_qlouds) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_error_margin.pivot(index=air_qloud_literal, columns='Week', values=weekly_average_error_margin_literal)

    elif len(device_names) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_error_margin.pivot(index=device_number_literal, columns='Week', values=weekly_average_error_margin_literal)

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    # Reset the index to make air_qloud_literal a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
#this is sample code:  formatted_weekly_error_margin = format_weekly_error_margin_output(weekly_error_margin, air_qlouds, device_names)


"""### Weekly sensor error margin trends"""
def plot_weekly_error(pivot_table, air_qlouds, device_names):
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    if len(air_qlouds) > 0:
      melted_df = pd.melt(pivot_table, id_vars=[air_qloud_literal], var_name='Week', value_name=weekly_average_error_margin_literal)

      fig = px.bar(melted_df, x=air_qloud_literal, y=weekly_average_error_margin_literal, color='Week',
                 barmode='group', labels={'x': air_qloud_literal, 'y': weekly_average_error_margin_literal},
                 title='Weekly Average Error Margin per AirQloud',
                 hover_name=air_qloud_literal, hover_data=['Week', weekly_average_error_margin_literal])

    elif len(device_names) > 0:
      melted_df = pd.melt(pivot_table, id_vars=[device_number_literal], var_name='Week', value_name=weekly_average_error_margin_literal)

      fig = px.bar(melted_df, x=device_number_literal, y=weekly_average_error_margin_literal, color='Week',
                 barmode='group', labels={'x': device_number_literal, 'y': weekly_average_error_margin_literal},
                 title='Weekly Average Error Margin per Device',
                 hover_name=device_number_literal, hover_data=['Week', weekly_average_error_margin_literal])

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    fig.update_layout(height=600, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_weekly_error(formatted_weekly_error_margin, air_qlouds, device_names)


"""## Device completeness
### Weekly device completeness"""
def calculate_daily_completeness_per_device(df):
    # Ensure 'created_at' is in datetime format
    df['created_at'] = pd.to_datetime(df['created_at'])

    # Extract date and hour from 'created_at'
    df['Date'] = df['created_at'].dt.date
    df['Hour'] = df['created_at'].dt.hour

    # Group by device_number_literal, 'Date', and 'Hour' to calculate hourly completeness
    hourly_completeness = df.groupby([device_number_literal, 'Date', 'Hour']).size().reset_index(name='Count')

    # Group by device_number_literal and 'Date' to calculate daily completeness (average number of entries per hour)
    daily_completeness = hourly_completeness.groupby([device_number_literal, 'Date'])['Count'].mean().reset_index(name=daily_completeness_entries_hour_literal)

    return daily_completeness
#this is sample code:  daily_completeness = calculate_daily_completeness_per_device(final_df)

def calculate_weekly_average_completeness(df, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    # Calculate daily completeness per device
    daily_completeness = calculate_daily_completeness_per_device(df)

    # Convert 'Date' to datetime to extract the week
    daily_completeness['Date'] = pd.to_datetime(daily_completeness['Date'])
    daily_completeness['Week'] = daily_completeness['Date'].dt.to_period('W').apply(lambda r: r.start_time)

    # Merge the daily completeness with the original dataframe to get air_qloud_literal
    merged_df = daily_completeness.merge(df[[device_number_literal, air_qloud_literal]].drop_duplicates(), on=device_number_literal)

    if len(air_qlouds) > 0:
      # Group by air_qloud_literal and 'Week' to calculate the weekly average completeness
      weekly_completeness = merged_df.groupby([air_qloud_literal, 'Week'])[daily_completeness_entries_hour_literal].mean().reset_index(name=weekly_average_completeness_literal)

    elif len(device_names) > 0:
      # Group by device_number_literal and 'Week' to calculate the weekly average completeness
      weekly_completeness = merged_df.groupby([device_number_literal, 'Week'])[daily_completeness_entries_hour_literal].mean().reset_index(name=weekly_average_completeness_literal)

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    return weekly_completeness
#this is sample code:  weekly_completeness = calculate_weekly_average_completeness(final_df, air_qlouds, device_names)

def format_weekly_completeness_output(weekly_completeness, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error

    if len(air_qlouds) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_completeness.pivot(index=air_qloud_literal, columns='Week', values=weekly_average_completeness_literal)

    elif len(device_names) > 0:
      # Pivot the table to get weeks as columns and AirQlouds as rows
      pivot_table = weekly_completeness.pivot(index=device_number_literal, columns='Week', values=weekly_average_completeness_literal)

    else:
      return either_air_qlouds_or_device_names_must_have_data_error

    # Reset the index to make air_qloud_literal a column
    pivot_table.reset_index(inplace=True)

    return pivot_table
# this is sample code: formatted_weekly_completeness = format_weekly_completeness_output(weekly_completeness, air_qlouds, device_names)


"""### Weekly data completeness trend"""
def plot_weekly_completeness(pivot_table, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
        return air_qlouds_and_device_names_error

    if len(air_qlouds) > 0:
        melted_df = pd.melt(pivot_table, id_vars=[air_qloud_literal], var_name='Week', value_name=weekly_average_completeness_literal)

        fig = px.bar(melted_df, x=air_qloud_literal, y=weekly_average_completeness_literal, color='Week',
                     barmode='group', labels={'x': air_qloud_literal, 'y': weekly_average_completeness_literal},
                     title='Weekly Average Completeness (entries/hour) per AirQloud',
                     hover_name=air_qloud_literal, hover_data=['Week', weekly_average_completeness_literal])

    elif len(device_names) > 0:
        melted_df = pd.melt(pivot_table, id_vars=[device_number_literal], var_name='Week', value_name=weekly_average_completeness_literal)

        fig = px.bar(melted_df, x=device_number_literal, y=weekly_average_completeness_literal, color='Week',
                     barmode='group', labels={'x': device_number_literal, 'y': weekly_average_completeness_literal},
                     title='Weekly Average Completeness (entries/hour) per Device',
                     hover_name=device_number_literal, hover_data=['Week', weekly_average_completeness_literal])

    else:
        return either_air_qlouds_or_device_names_must_have_data_error

    fig.update_layout(height=600, width=1200, showlegend=False)
    fig.show(renderer='colab')
# plot_weekly_completness(formatted_weekly_completeness, air_qlouds, device_names)
# Alias for backward compatibility
plot_weekly_completness = plot_weekly_completeness
