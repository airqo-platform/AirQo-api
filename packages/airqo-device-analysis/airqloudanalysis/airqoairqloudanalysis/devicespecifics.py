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
created_at_literal = 'created_at'
sensor1_pm25_literal = 'Sensor1 PM2.5_CF_1_ug/m3'
sensor2_pm25_literal = 'Sensor2 PM2.5_CF_1_ug/m3'
battery_voltage_literal = 'Battery Voltage'
air_qloud_literal = 'AirQloud'
air_qloud_id_literal = 'AirQloud ID'
air_qloud_type_literal = 'AirQloud Type'
optimal_completeness_literal = 'Optimal Completeness'
good_completeness_literal = 'Good Completeness'
fair_completeness_literal = 'Fair Completeness'
poor_completeness_literal = 'Poor Completeness'
lines_markers_literal = 'lines+markers'
air_qlouds_and_device_names_error = "air_qlouds and device_names  can not both have data"
online_completeness_literal = 'Online Completeness'
no_air_qlouds_selected_literal = "No AirQlouds selected"

"""# Device specifics
 This shows the specific details of the each of the selected devices selected

## Sensor health

### Regplot/Scatterplot

#### Description:
This has the intra sensor scatter plots along with the regression lines for the before and after maintenance along with the line of fit equations and R-squared values visible if you hover over the lines.


To do:

Regression + R Squared value on the hover text
Size of the markers"""
def device_data_api(data_frame, maintenence_date):
    # Ensure the created_at_literal column is in datetime format and timezone-aware
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal]).dt.tz_localize(None)
    # data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal], errors='coerce', utc=True)
    # Convert maintenanceDate to datetime if it's not already
    maintenence_date = pd.to_datetime(maintenence_date)
    # Initialize an empty list to store the result data
    results = []
    # Extract unique device numbers
    device_numbers = data_frame[device_number_literal].unique()
    for device_number in device_numbers:
        # Filter data for the current device
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        # Data before maintenance
        before_df = device_df[device_df[created_at_literal] <= maintenence_date][[device_number_literal, created_at_literal, sensor1_pm25_literal, sensor2_pm25_literal, battery_voltage_literal, air_qloud_literal, air_qloud_id_literal, air_qloud_type_literal]]
        before_df['Status'] = 'Before'

        ## Sensor health
        # Data after maintenance
        after_df = device_df[device_df[created_at_literal] > maintenence_date][[device_number_literal, created_at_literal, sensor1_pm25_literal, sensor2_pm25_literal, battery_voltage_literal, air_qloud_literal, 'AirQloud ID', 'AirQloud Type']]
        after_df['Status'] = 'After'
        # Append both before and after data to the results
        results.append(before_df)
        results.append(after_df)
    # Concatenate the results into a single DataFrame
    result_df = pd.concat(results, ignore_index=True)
    return result_df
# this is sample code : device_data_apiss = device_data_api(final_df, maintenence_date)



def reg_sensor_correlation(data_frame, maintenence_date):
    # Extract unique device numbers
    device_numbers = data_frame[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        row = i // num_cols + 1
        col = i % num_cols + 1

        s1 = device_df[device_df['Date'] <= maintenence_date]
        s2 = device_df[device_df['Date'] > maintenence_date]

        # Scatter plot for before maintenance
        scatter_before = go.Scatter(
            x=s1[sensor1_pm25_literal],
            y=s1[sensor2_pm25_literal],
            mode='markers',
            name='Before',
            marker=dict(color='blue', size=3),
            hoverinfo='text',
            hovertext=[f"({x:.2f}, {y:.2f})" for x, y in zip(s1[sensor1_pm25_literal], s1[sensor2_pm25_literal])]
        )
        fig.add_trace(scatter_before, row=row, col=col)

        # Scatter plot for after maintenance
        scatter_after = go.Scatter(
            x=s2[sensor1_pm25_literal],
            y=s2[sensor2_pm25_literal],
            mode='markers',
            name='After',
            marker=dict(color='red', size=3),
            hoverinfo='text',
            hovertext=[f"({x:.2f}, {y:.2f})" for x, y in zip(s2[sensor1_pm25_literal], s2[sensor2_pm25_literal])]
        )
        fig.add_trace(scatter_after, row=row, col=col)

        # Scatter plot
        scatter = go.Scatter(
            x=device_df[sensor1_pm25_literal],
            y=device_df[sensor2_pm25_literal],
            mode='markers',
            name=f'{device_number}',
            marker=dict(color='red', size=3),
            hoverinfo='text',
            hovertext=[f"({x:.2f}, {y:.2f})" for x, y in zip(device_df[sensor1_pm25_literal], device_df[sensor2_pm25_literal])]
        )

        fig.add_trace(scatter, row=row, col=col)

        # Calculate and plot regression line
        try:
            if not s1.empty:
                reg_before = np.polyfit(s1[sensor1_pm25_literal], s1[sensor2_pm25_literal], 1)
                x_range_before = np.linspace(min(s1[sensor1_pm25_literal]), max(s1[sensor1_pm25_literal]), 100)
                y_range_before = np.polyval(reg_before, x_range_before)
                rsquared_before = np.corrcoef(s1[sensor1_pm25_literal], s1[sensor2_pm25_literal])[0, 1] ** 2
                fig.add_trace(go.Scatter(x=x_range_before, y=y_range_before, mode='lines', line=dict(color='blue', width=2), name='Before',
                                         hoverinfo='text', hovertext=f"y = {reg_before[0]:.2f}x + {reg_before[1]:.2f}, R-Squared = {rsquared_before:.2f}"), row=row, col=col)

            if not s2.empty:
                reg_after = np.polyfit(s2[sensor1_pm25_literal], s2[sensor2_pm25_literal], 1)
                x_range_after = np.linspace(min(s2[sensor1_pm25_literal]), max(s2[sensor1_pm25_literal]), 100)
                y_range_after = np.polyval(reg_after, x_range_after)
                rsquared_after = np.corrcoef(s2[sensor1_pm25_literal], s2[sensor2_pm25_literal])[0, 1] ** 2
                fig.add_trace(go.Scatter(x=x_range_after, y=y_range_after, mode='lines', line=dict(color='red', width=2), name='After',
                                         hoverinfo='text', hovertext=f"y = {reg_after[0]:.2f}x + {reg_after[1]:.2f}, R-Squared = {rsquared_after:.2f}"), row=row, col=col)
        except np.linalg.LinAlgError as e:
            print(f"Error calculating regression for device {device_number}: {e}")

        fig.update_xaxes(title_text=sensor1_pm25_literal, row=row, col=col)
        fig.update_yaxes(title_text=sensor2_pm25_literal, row=row, col=col)

    fig.update_layout(height=400*num_rows, width=1200, showlegend=False)

    fig.show(renderer="colab")
# this is sample code : reg_sensor_correlation(final_df, maintenence_date)


"""### Error Margin
#### Description:
 E.g. Acceptable range 5<=e<=-5 at any piont of time

To do:

Try also using *boxplots* to show distribution of error margin. Boxplots will isolate outliers well in this case"""
def error_margin(data_frame, end, maintenence_date):
    # Convert created_at_literal to datetime if it's not already and convert to UTC timezone
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal]).dt.tz_convert('UTC')

    # Convert end date to datetime and localize to UTC
    end_date = pd.to_datetime(end).tz_localize('UTC')

    # Filter data for the last 2 weeks up to the end date
    start_date = end_date - pd.DateOffset(weeks=2)
    filtered_df = data_frame[(data_frame[created_at_literal] >= start_date) & (data_frame[created_at_literal] <= end_date)]

    # Calculate error margin between Sensor1 and Sensor2 PM2.5 readings
    filtered_df['Error Margin'] = abs(filtered_df[sensor1_pm25_literal] - filtered_df[sensor2_pm25_literal])

    # Extract unique device numbers from filtered data
    device_numbers = filtered_df[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = filtered_df[filtered_df[device_number_literal] == device_number]
        row = i // num_cols + 1
        col = i % num_cols + 1

        s1 = device_df[device_df['Date'] <= maintenence_date]
        s2 = device_df[device_df['Date'] > maintenence_date]

        if not s1.empty:
          # Plot error margin with color differentiation
          error_margin1 = (s1[sensor1_pm25_literal] - s1[sensor2_pm25_literal])
          fig.add_trace(go.Scatter(x=s1[created_at_literal], y=error_margin1, mode='markers', name='Error Margin Before', marker=dict(size=1, color='blue')), row=row, col=col)
          fig.add_trace(go.Scatter(x=s1[created_at_literal], y=np.zeros_like(s1[created_at_literal]), mode='markers', name='Before', marker=dict(size=5, color='green')), row=row, col=col)

        if not s2.empty:
          error_margin2 = (s2[sensor1_pm25_literal] - s2[sensor2_pm25_literal])
          fig.add_trace(go.Scatter(x=s2[created_at_literal], y=error_margin2, mode='markers', name='Error Margin After', marker=dict(size=1, color='red')), row=row, col=col)
          fig.add_trace(go.Scatter(x=s2[created_at_literal], y=np.zeros_like(s2[created_at_literal]), mode='markers', name='After', marker=dict(size=5, color='green')), row=row, col=col)


        # Plot black lines at positive and negative 5
        fig.add_trace(go.Scatter(x=s1[created_at_literal], y=np.full_like(s1[created_at_literal], 5), mode='lines', name='Positive 5', line=dict(color='black', width=1, dash='dash')), row=row, col=col)
        fig.add_trace(go.Scatter(x=s1[created_at_literal], y=np.full_like(s1[created_at_literal], -5), mode='lines', name='Negative 5', line=dict(color='black', width=1, dash='dash')), row=row, col=col)
        fig.add_trace(go.Scatter(x=s2[created_at_literal], y=np.full_like(s2[created_at_literal], 5), mode='lines', name='Positive 5', line=dict(color='black', width=1, dash='dash')), row=row, col=col)
        fig.add_trace(go.Scatter(x=s2[created_at_literal], y=np.full_like(s2[created_at_literal], -5), mode='lines', name='Negative 5', line=dict(color='black', width=1, dash='dash')), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Date', row=row, col=col)
        fig.update_yaxes(title_text='Sensor Error Margin', row=row, col=col)

    fig.update_layout(height=300 * num_rows, width=1200, showlegend=False)
    fig.show(renderer="colab")
# error_margin(final_df, end, maintenence_date)


"""### Box plot for the sensor error margin
#### Description:
This contains details of the sensor errors for before and after highlighting the
* Max
* Min
* Median
* 1st, 2nd, 3rd and 4th quaters"""
def error_margin_boxplot(data_frame, end, maintenence_date):
    # Calculate error margin between Sensor1 and Sensor2 PM2.5 readings
    data_frame['Error Margin'] = abs(data_frame[sensor1_pm25_literal] - data_frame[sensor2_pm25_literal])

    # Extract unique device numbers from filtered data
    device_numbers = data_frame[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        row = i // num_cols + 1
        col = i % num_cols + 1

        s1 = device_df[device_df['Date'] <= maintenence_date]
        s2 = device_df[device_df['Date'] > maintenence_date]

         # Calculate error margin between Sensor1 and Sensor2
        error_margin1 = (s1[sensor1_pm25_literal] - s1[sensor2_pm25_literal])
        error_margin2 = (s2[sensor1_pm25_literal] - s2[sensor2_pm25_literal])


        # Plot box plots for error margin
        fig.add_trace(go.Box(y=error_margin1, name='Error Margin Before', marker_color='blue'), row=row, col=col)
        fig.add_trace(go.Box(y=error_margin2, name='Error Margin After', marker_color='red'), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Maintenance', row=row, col=col)
        fig.update_yaxes(title_text='Sensor Error Margin', row=row, col=col)

    fig.update_layout(height=400 * num_rows, width=1200, showlegend=False)
    fig.show(renderer="colab")
# error_margin_boxplot(final_df, end, maintenence_date)


"""### Average sensor error
To do:
Try play with marker size
- Plot straight line at the minimum error margin i.e plot two lines at -5 and +5 and +10 -10
"""
def daily_error_margin(data_frame, maintenence_date):
    # Extract unique device numbers
    device_numbers = data_frame[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        row = i // num_cols + 1
        col = i % num_cols + 1

        s1 = device_df[device_df['Date'] <= maintenence_date]
        s2 = device_df[device_df['Date'] > maintenence_date]

         # Calculate absolute error margin between Sensor1 and Sensor2
        s1['error_margin_before'] = np.abs(s1[sensor1_pm25_literal] - s1[sensor2_pm25_literal])
        s2['error_margin_after'] = np.abs(s2[sensor1_pm25_literal] - s2[sensor2_pm25_literal])

        # Group by hourly and calculate average error margin for both before and after maintenance
        s1['timestamp'] = s1[created_at_literal].dt.strftime('%Y-%m-%d %H') #('%Y-%m-%d') daily average
        s2['timestamp'] = s2[created_at_literal].dt.strftime('%Y-%m-%d %H') #('%Y-%m-%d') daily average
        hourly_avg_error_margin_before = s1.groupby('timestamp').agg({'error_margin_before': 'mean'}).reset_index()
        hourly_avg_error_margin_after = s2.groupby('timestamp').agg({'error_margin_after': 'mean'}).reset_index()

        # Plot hourly average error margin for both before and after maintenance
        fig.add_trace(go.Scatter(x=hourly_avg_error_margin_before['timestamp'], y=hourly_avg_error_margin_before['error_margin_before'], mode=lines_markers_literal, name='Hourly Avg Error Margin Before', marker=dict(color='blue', size = 1)), row=row, col=col) #mode changed to markers
        fig.add_trace(go.Scatter(x=hourly_avg_error_margin_after['timestamp'], y=hourly_avg_error_margin_after['error_margin_after'], mode=lines_markers_literal, name='Hourly Avg Error Margin After', marker=dict(color='red')), row=row, col=col)

        # Add horizontal lines at positive and negative 5
        fig.add_hline(y=5, line=dict(color='black', width=1, dash='dash'), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Date', row=row, col=col)
        fig.update_yaxes(title_text='Hourly Sensor Error Margin', row=row, col=col)

    fig.update_layout(height=400 * num_rows, width=1200, showlegend=False)
    fig.show(renderer="colab")
# daily_error_margin(final_df, maintenence_date)

"""### Daily average sensor error tablular"""
def daily_error_margin_pivot(data_frame):
    # Calculate error margin
    data_frame['error_margin'] = np.abs(data_frame[sensor1_pm25_literal] - data_frame[sensor2_pm25_literal])
    data_frame['Date'] = data_frame[created_at_literal].dt.date

    # Group by 'Device Number' and 'Date', calculate daily average error margin
    daily_avg_error_margin = data_frame.groupby([device_number_literal, 'Date'])['error_margin'].mean().reset_index()

    # Pivot the dataframe to have dates as columns and daily error margins as values
    pivoted_df = daily_avg_error_margin.pivot(index=device_number_literal, columns='Date', values='error_margin').reset_index()

    # Rename the columns for better readability (optional)
    pivoted_df.columns.name = None  # Remove the 'Date' from column headers

    return pivoted_df
# this is sample code : pivoted_error_margin_df = daily_error_margin_pivot(final_df)


"""### Intra-Sensor Correlation Matrix
#### Description:
This plot is for the intra sensor correlation of any device in an AirQloud
To do:
Define the ylim to be between -1 and 1"""
def sensor_correlation(final_data):
    device_numbers = final_data[device_number_literal].unique()
    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + 2) // 3  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = final_data[final_data[device_number_literal] == device_number]

        device_df = device_df[[sensor1_pm25_literal, sensor2_pm25_literal, 'Date']].groupby(['Date']).corr().round(4) * 100
        device_df.reset_index(inplace=True)
        device_df = device_df.drop(device_df[device_df['level_1'] == sensor2_pm25_literal].index)
        device_df.drop(['level_1', sensor1_pm25_literal], axis=1, inplace=True)
        device_df = device_df.rename(columns={"Sensor2 PM2.5_CF_1_ug/m3": "R"})

        s1 = device_df[device_df['R'] <= 98.5]  # Before maintenance
        s2 = device_df[device_df['R'] > 98.5]  # After maintenance

        row = i // num_cols + 1
        col = i % num_cols + 1

        fig.add_trace(go.Scatter(x=s1['Date'], y=s1['R'], mode=lines_markers_literal, marker_symbol='asterisk-open', marker_line_color="midnightblue",
                                 marker_size=15, name=f'{device_number} R-Before', line=dict(color='blue')), row=row, col=col)
        fig.add_trace(go.Scatter(x=s2['Date'], y=s2['R'], mode=lines_markers_literal, marker_symbol='hash-open', marker_line_color="midnightblue",
                                 marker_size=15, marker_line_width=2, name=f'{device_number} R-After', line=dict(color='red')), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Date', row=row, col=col)
        fig.update_yaxes(title_text='Sensor Correlation (%)', row=row, col=col)

    fig.update_layout(height=400 * num_rows, width=1200, showlegend=False)
    fig.show(renderer="colab")
# sensor_correlation(final_df)


"""## Battery Voltage/ SOC/ SOH
### Battery Voltage Timeseries
* This is plotted for the device battery voltage Vs time to show the battery performance
"""
def battery_voltage(data_frame, end, maintenence_date):
    # Convert created_at_literal to datetime if it's not already and convert to UTC timezone
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal]).dt.tz_convert('UTC')

    # Convert end date to datetime and localize to UTC
    end_date = pd.to_datetime(end).tz_localize('UTC')

    # Filter data for the last 2 weeks up to the end date
    start_date = end_date - pd.DateOffset(weeks=2)
    filtered_df = data_frame[(data_frame[created_at_literal] >= start_date) & (data_frame[created_at_literal] <= end_date)]

    # Extract unique device numbers from filtered data
    device_numbers = filtered_df[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = filtered_df[filtered_df[device_number_literal] == device_number]
        row = i // num_cols + 1
        col = i % num_cols + 1

        s1 = device_df[device_df['Date'] <= maintenence_date]
        s2 = device_df[device_df['Date'] > maintenence_date]

        # Convert timestamps to Unix time
        s1_unix_time = s1[created_at_literal].astype(np.int64) // 10**9
        s2_unix_time = s2[created_at_literal].astype(np.int64) // 10**9

        if not s1_unix_time.empty:
            fig.add_trace(go.Scatter(x=s1[created_at_literal], y=s1[battery_voltage_literal], mode='markers', name='Before', marker=dict(size=1, color='blue')), row=row, col=col)

        if not s2_unix_time.empty:
            fig.add_trace(go.Scatter(x=s2[created_at_literal], y=s2[battery_voltage_literal], mode='markers', name='After', marker=dict(size=2, color='red')), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Date', row=row, col=col)
        fig.update_yaxes(title_text=battery_voltage_literal, row=row, col=col)

    fig.update_layout(height=300 * num_rows, width=1200, showlegend=False)
    fig.show(renderer="colab")
# battery_voltage(final_df, end, maintenence_date)


"""### C-Rate
#### Description:
+ This contains the **mean hourly** rate of the change of the battery with time (dV/dt)
+ This graphs explain how long it takes to charge and discharge
+ Expected charge vs discharge sequence chart?
+ What is the time that the battery experiences sudden discharge?
+ C-Rate - rate at which battery charges or discharges
+ Battery capacity decreases with increase in C-Rate
+ Avg I = Ah (battery capacity)/dT (number of hours of discharge)"""
def c_rate(data_frame, end):
    # Convert created_at_literal to datetime if it's not already and convert to UTC timezone
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal]).dt.tz_convert('UTC')

    # Convert end date to datetime and localize to UTC
    end_date = pd.to_datetime(end).tz_localize('UTC')

    # Filter data for the last 2 weeks up to the end date
    start_date = end_date - pd.DateOffset(weeks=2)
    filtered_df = data_frame[(data_frame[created_at_literal] >= start_date) & (data_frame[created_at_literal] <= end_date)]

    # Extract unique device numbers from filtered data
    device_numbers = filtered_df[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        device_df = filtered_df[filtered_df[device_number_literal] == device_number].sort_values(created_at_literal)

        # Ensure created_at_literal is the index before resampling
        device_df = device_df.set_index(created_at_literal)
        device_df = device_df.resample('H').mean(numeric_only=True).reset_index()

        # Calculate the rate of change of battery voltage per hour
        device_df['rate'] = device_df[battery_voltage_literal].diff()

        row = i // num_cols + 1
        col = i % num_cols + 1

        fig.add_trace(go.Scatter(x=device_df[created_at_literal], y=device_df['rate'],
                                 mode='lines', name='Charge/Discharge Rate', marker=dict(color='red', size=5)), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Date', row=row, col=col)
        fig.update_yaxes(title_text='Rate (V/hour)', row=row, col=col)

    fig.update_layout(height=400 * num_rows, width=1200, showlegend=False)
    fig.show(renderer="colab")
# c_rate(final_df, end)


"""### Dunial device
+ This provides insight into the avaerage data points per hour for the hours of the day both before and after maintenance
"""
def duinal_device_data(data_frame):
    # Extract unique device numbers from the data
    device_numbers = data_frame[device_number_literal].unique()

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_numbers):
        # Filter the dataframe for the current device number
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        row = i // num_cols + 1
        col = i % num_cols + 1

        # Convert created_at_literal column to datetime format
        device_df[created_at_literal] = pd.to_datetime(device_df[created_at_literal])

        # Extract the hour of the day for each data point
        device_df['hour'] = device_df[created_at_literal].dt.hour

        # Calculate the average number of data points for each hour
        device_df_hourly_avg = device_df.groupby('hour').size().reindex(np.arange(24), fill_value=0) / device_df[created_at_literal].dt.date.nunique()

        # Create a bar plot for the average number of data points per hour
        fig.add_trace(go.Bar(x=device_df_hourly_avg.index, y=device_df_hourly_avg.values, name=device_number, marker=dict(color='blue')), row=row, col=col)

        # Update axes labels
        fig.update_xaxes(title_text='Hour of the Day', row=row, col=col)
        fig.update_yaxes(title_text='Avg Data Points per Hour', row=row, col=col)

    fig.update_layout(height=300 * num_rows, width=1200, showlegend=False, title='Average Data Points per Hour')
    fig.show(renderer='colab')
# duinal_device_data(final_df)


"""## Device State/Uptime
### Daily State/ Entries
* This plots the number of entries for each device per day with different color coding
* entires <=9  --> crimson
* 10 <= entries <= 15 --> orange
* 16 <= entries <= 20 --> yellow
* entries > 20 --> green"""
def get_color_uptime(uptime):
    if uptime <= 9:
        return 'crimson'
    elif 10 <= uptime <= 15:
        return 'orange'
    elif 16 <= uptime <= 20:
        return 'yellow'
    else:
        return 'green'
# get_color_uptime(9)

def plot_uptime(data_frame):
    # Convert created_at_literal to datetime if it's not already and convert to UTC timezone
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal]).dt.tz_convert('UTC')

    # Extract unique device numbers
    device_numbers = data_frame[device_number_literal].unique()

    # Calculate uptime for each device by date
    uptime_list = []
    for device_number in device_numbers:
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        device_df['date'] = device_df[created_at_literal].dt.date
        device_df['hour'] = device_df[created_at_literal].dt.hour
        uptime_df = device_df.groupby('date')['hour'].nunique().reset_index()
        uptime_df.columns = ['date', 'uptime']
        uptime_list.append(uptime_df)

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, (device_number, uptime_df) in enumerate(zip(device_numbers, uptime_list)):
        row = i // num_cols + 1
        col = i % num_cols + 1

        colors = [get_color_uptime(uptime) for uptime in uptime_df['uptime']]

        trace = go.Bar(x=uptime_df['date'], y=uptime_df['uptime'],
                       marker=dict(color=colors),
                       name=f'Device {device_number}')

        fig.add_trace(trace, row=row, col=col)

        fig.update_xaxes(title_text='Date', row=row, col=col, tickangle=45)
        fig.update_yaxes(title_text='Uptime (Hours)', row=row, col=col)

    fig.update_layout(height=300*num_rows, width=1200, showlegend=False)

    fig.show(renderer="colab")
# plot_uptime(final_df)


"""### Daily Uptime/SOH/ Performance/ Quality [descriptive uptime]
#### Description:
Qualitative daily state of health quantified based on hourly entries i.e:
* Hourly entries > 17 - Optimal
* 15 <= * Hourly entries  <= 17 - Good
* 10 <= * Hourly entries  <= 14 - Fair
* Hourly entries < 10 - Poor"""
def descriptive_uptime_color(data_entry):
    if data_entry >= 18:
        return 'green'
    elif 15 <= data_entry <= 17:
        return 'yellow'
    elif 10 <= data_entry <= 14:
        return 'orange'
    else:
        return 'crimson'
# descriptive_uptime_color(18)

def descriptive_uptime_plot(data_frame):
    # Convert created_at_literal to datetime and extract date
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal], utc=True) # Convert to datetime with UTC timezone
    data_frame['date'] = data_frame[created_at_literal].dt.date
    data_frame['hour'] = data_frame[created_at_literal].dt.hour

    # Extract unique device numbers
    device_numbers = data_frame[device_number_literal].unique()

    device_dict = defaultdict(lambda: {'date': [], 'optimal': [], 'good': [], 'fair': [], 'poor': []})

    # Calculate uptime per hour and categorize
    for device_number in device_numbers:
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        # Count occurrences per hour and date
        hourly_counts = device_df.groupby(['date', 'hour']).size().reset_index(name='data_entries')

        # Group by date and calculate number of entries categorized
        grouped = hourly_counts.groupby('date')['data_entries'].apply(list).reset_index()
        for _, row in grouped.iterrows():
            date = row['date']
            entries = row['data_entries']
            optimal_count = sum(1 for entry in entries if descriptive_uptime_color(entry) == 'green')
            good_count = sum(1 for entry in entries if descriptive_uptime_color(entry) == 'yellow')
            fair_count = sum(1 for entry in entries if descriptive_uptime_color(entry) == 'orange')
            poor_count = sum(1 for entry in entries if descriptive_uptime_color(entry) == 'crimson')

            device_dict[device_number]['date'].append(date)
            device_dict[device_number]['optimal'].append(optimal_count)
            device_dict[device_number]['good'].append(good_count)
            device_dict[device_number]['fair'].append(fair_count)
            device_dict[device_number]['poor'].append(poor_count)

    # Define number of columns and rows for plotting
    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, device_number in enumerate(device_dict.keys()):
        row = i // num_cols + 1
        col = i % num_cols + 1

        trace_optimal = go.Bar(x=device_dict[device_number]['date'], y=device_dict[device_number]['optimal'], name='Optimal', marker=dict(color='green'))
        trace_good = go.Bar(x=device_dict[device_number]['date'], y=device_dict[device_number]['good'], name='Good', marker=dict(color='yellow'))
        trace_fair = go.Bar(x=device_dict[device_number]['date'], y=device_dict[device_number]['fair'], name='Fair', marker=dict(color='orange'))
        trace_poor = go.Bar(x=device_dict[device_number]['date'], y=device_dict[device_number]['poor'], name='Poor', marker=dict(color='crimson'))

        fig.add_trace(trace_optimal, row=row, col=col)
        fig.add_trace(trace_good, row=row, col=col)
        fig.add_trace(trace_fair, row=row, col=col)
        fig.add_trace(trace_poor, row=row, col=col)

    # Update layout
    fig.update_layout(height=400*num_rows, width=1200, showlegend=False, barmode='stack')
    fig.show(renderer="colab")
# descriptive_uptime_plot(final_df)


"""### Data Completeness
* This plots the number of entries for each device per hour with different color coding
* entires <=9  --> crimson
* 10 <= entries <= 15 --> orange
* 16 <= entries <= 20 --> yellow
* entries > 20 --> green
To do:
Try to only show last 48 hours or 3 days"""
def get_color(uptime):
    if uptime <= 9:
        return 'crimson'
    elif 10 <= uptime <= 15:
        return 'orange'
    elif 16 <= uptime <= 20:
        return 'yellow'
    else:
        return 'green'
# get_color(9)

def plot_data_completeness(data_frame, end_date):
    # Convert created_at_literal to datetime if it's not already and convert to UTC timezone
    data_frame[created_at_literal] = pd.to_datetime(data_frame[created_at_literal]).dt.tz_convert('UTC')

    # Convert end_date to datetime with UTC timezone
    end_date = pd.to_datetime(end_date, utc=True)

    # Calculate start date as 14 days before the end date
    start_date = end_date - timedelta(days=14)

    # Filter data for the last two weeks
    data_frame = data_frame[(data_frame[created_at_literal] >= start_date) & (data_frame[created_at_literal] <= end_date)]

    # Extract unique device numbers
    device_numbers = data_frame[device_number_literal].unique()

    # device_df['timestamp'] = device_df[created_at_literal].dt.strftime('%Y-%m-%d %H')
    # Calculate uptime for each device by date
    uptime_list = []
    for device_number in device_numbers:
        device_df = data_frame[data_frame[device_number_literal] == device_number]
        device_df['date'] = device_df[created_at_literal].dt.date
        device_df['hour'] = device_df[created_at_literal].dt.hour
        device_df['timestamp'] = device_df[created_at_literal].dt.strftime('%Y-%m-%d %H')
        # Apply count aggregation after groupby
        uptime_df = device_df.groupby('timestamp')[created_at_literal].count().reset_index(name='uptime')
        uptime_list.append(uptime_df)

    num_devices = len(device_numbers)
    num_cols = 3  # Number of columns in the subplot grid
    num_rows = (num_devices + num_cols - 1) // num_cols  # Number of rows in the subplot grid, rounding up

    fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=device_numbers)

    for i, (device_number, uptime_df) in enumerate(zip(device_numbers, uptime_list)):
        row = i // num_cols + 1
        col = i % num_cols + 1

        colors = [get_color(uptime) for uptime in uptime_df['uptime']]

        trace = go.Bar(x=uptime_df['timestamp'], y=uptime_df['uptime'],
                       marker=dict(color=colors),
                       name=f'Device {device_number}')

        fig.add_trace(trace, row=row, col=col)

        fig.update_xaxes(title_text='timestamp', row=row, col=col, tickangle=45)
        fig.update_yaxes(title_text='Hourly Count', row=row, col=col)

    fig.update_layout(height=300*num_rows, width=1200, showlegend=False)

    fig.show(renderer="colab")
# plot_data_completeness(final_df, end)


"""## AirQloud Health
### This is divided into the three main components of device health
* Sensor correlation
* Battery performance
* Data completeness and uptime

### Sensor health
#### Color coding
* Green -> optimal sensor quality with error <= 5
* Yellow -> good sensor quality with 6 <= error <= 10
* Orange -> Fair sensor quality with 11 <= error <= 12
* Crimson -> Poor sensor quality with error > 12"""
def get_sensor_health_counts(df):
    # Calculate error margin between Sensor1 and Sensor2
    error_margin = np.abs(df[sensor1_pm25_literal] - df[sensor2_pm25_literal])

    # Count occurrences of different error margin ranges
    green_count = np.sum(error_margin <= 5)
    yellow_count = np.sum((error_margin >= 6) & (error_margin <= 10))
    orange_count = np.sum((error_margin >= 11) & (error_margin <= 12))
    poor_count = np.sum(error_margin >= 12)

    return green_count, yellow_count, orange_count, poor_count
# get_sensor_health_counts(final_df)

def sensor_health(df, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error
    if len(air_qlouds) > 0:
      airqlouds = df[air_qloud_literal].unique()
      num_airqlouds = len(airqlouds)

      num_cols = 2  # Two pie charts per row
      num_rows = (num_airqlouds + 1) // 2  # Number of rows required

      fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=airqlouds, specs=[[{'type':'pie'}, {'type':'pie'}]] * num_rows)

      for i, airqloud in enumerate(airqlouds):
        airqloud_df = df[df[air_qloud_literal] == airqloud]
        green_count, yellow_count, orange_count, poor_count = get_sensor_health_counts(airqloud_df)

        labels = ['Optimal', 'Good', 'Fair', 'Poor']
        values = [green_count, yellow_count, orange_count, poor_count]
        colors = ['green', 'yellow', 'orange', 'crimson']

        row = i // num_cols + 1
        col = i % num_cols + 1

        fig.add_trace(go.Pie(labels=labels, values=values, hole=0.3, marker=dict(colors=colors)), row=row, col=col)

      fig.update_layout(title="AirQloud Sensor Health", title_font_size=20, height=400*num_rows, width=600*num_cols)

      fig.show(renderer="colab")

    else:
      return no_air_qlouds_selected_literal
# sensor_health(final_df, air_qlouds, device_names)


"""### Battery Performance
#### Color coding
* Green -> Device is on and posted with in the hour
* Grey -> Device is off and didn't post with in the hour"""
# Function to calculate the average uptime of the devices
def air_qloud_battery(df,start , end, aq_data, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error
    if len(air_qlouds) > 0:
      # time span
      weekly_df, analysis_duration_days, first_date_in_df, last_date_in_df = create_dates(start, end)
      analysis_duration_hours = analysis_duration_days * 24

      # Initialize lists to store results
      device_list = []
      online_completeness_lst = []
      offline_completeness_lst = []
      air_qloud_lst = []

      # Iterate over unique device numbers
      for device_number in df[device_number_literal].unique():
        # Filter data for the current device
        device_df = df[df[device_number_literal] == device_number]

        # Convert created_at_literal column to datetime
        device_df[created_at_literal] = pd.to_datetime(device_df[created_at_literal])

        # Extract date and hour
        device_df['date'] = device_df[created_at_literal].dt.date
        device_df['hour'] = device_df[created_at_literal].dt.hour
        device_df['timestamp'] = device_df[created_at_literal].dt.strftime('%Y-%m-%d %H')

        # Group by date and count unique hours for uptime
        uptime_df = device_df.groupby('date')['hour'].nunique().reset_index(name='uptime')
        completeness_df = device_df.groupby(['timestamp']).size().reset_index(name='data_entries')

        # Calculate online completeness
        online_count = completeness_df[(completeness_df['data_entries'] > 0)].shape[0]

        # Append results to lists
        device_list.append(device_number)
        online_completeness_lst.append(online_count)
        air_qloud_lst.append(device_df[air_qloud_literal].unique()[0])

      # Create final DataFrame to return
      result_df = pd.DataFrame({
        device_number_literal: device_list,
        online_completeness_literal: online_completeness_lst,
        air_qloud_literal: air_qloud_lst
      })

      # this is reducted code : merged_df = daily_completeness.merge(df[[device_number_literal, air_qloud_literal]].drop_duplicates(), on=device_number_literal)
      result_df = aq_data.merge(result_df[[device_number_literal, online_completeness_literal]].drop_duplicates(), on=device_number_literal, how='outer')
      result_df.fillna(0, inplace=True)
      result_df['Downtime'] = analysis_duration_hours - result_df[online_completeness_literal]
      result_df.drop(columns=['Read Key', 'Device ID' ], inplace=True)

      airqlouds = df[air_qloud_literal].unique()
      num_airqlouds = len(airqlouds)

      num_cols = 2  # Two pie charts per row
      num_rows = (num_airqlouds + 1) // 2  # Number of rows required
      fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=airqlouds, specs=[[{'type':'pie'}, {'type':'pie'}]] * num_rows)

      for i, airqloud in enumerate(airqlouds):
        airqloud_df = result_df[result_df[air_qloud_literal] == airqloud]

        labels = ['Online','Downtime']
        values = [airqloud_df[online_completeness_literal].sum(), airqloud_df['Downtime'].sum()]
        colors = ['green', 'grey']

        row = i // num_cols + 1
        col = i % num_cols + 1
        fig.add_trace(go.Pie(labels=labels, values=values, hole=0.3, marker=dict(colors=colors)), row=row, col=col)

      fig.update_layout(title="AirQloud Battery Performance", title_font_size=20, height=400*num_rows, width=600*num_cols)

      fig.show(renderer="colab")
    else:
      return no_air_qlouds_selected_literal
# air_qloud_battery(final_df, start, end, aq_data, air_qlouds, device_names)


"""### Data completeness
#### Color coding
* Green -> optimal device performance
* Yellow -> good device performance
* Orange -> Fair device performance
* Crimson -> Poor device performance
* Grey -> Device downtime"""
# Function to calculate the average uptime of the devices
def air_qloud_completeness(df,start , end, aq_data, air_qlouds, device_names):
    # Check if both lists are empty
    if len(air_qlouds) > 0 and len(device_names) > 0:
      return air_qlouds_and_device_names_error
    if len(air_qlouds) > 0:
      # time span
      weekly_df, analysis_duration_days, first_date_in_df, last_date_in_df = create_dates(start, end)
      analysis_duration_hours = analysis_duration_days * 24

      # Initialize lists to store results
      device_list = []
      optimal_completeness_lst = []
      good_completeness_lst = []
      fair_completeness_lst = []
      poor_completeness_lst = []
      offline_completeness_lst = []
      air_qloud_lst = []



      # Iterate over unique device numbers
      for device_number in df[device_number_literal].unique():
        # Filter data for the current device
        device_df = df[df[device_number_literal] == device_number]

        # Convert created_at_literal column to datetime
        device_df[created_at_literal] = pd.to_datetime(device_df[created_at_literal])

        # Extract date and hour
        device_df['date'] = device_df[created_at_literal].dt.date
        device_df['hour'] = device_df[created_at_literal].dt.hour
        device_df['timestamp'] = device_df[created_at_literal].dt.strftime('%Y-%m-%d %H')
        device_df['Error margin'] = np.abs(device_df[sensor1_pm25_literal] - device_df[sensor2_pm25_literal])

        # Group by date and count unique hours for uptime
        uptime_df = device_df.groupby('date')['hour'].nunique().reset_index(name='uptime')
        completeness_df = device_df.groupby(['timestamp']).size().reset_index(name='data_entries')
        #this is reducted code : error = magnitude(sensor1_pm25_literal - sensor2_pm25_literal)
        error_df = device_df.groupby(['timestamp'])['Error margin'].mean().reset_index(name='error')


        # Calculate average uptime
        average_uptime = round(uptime_df['uptime'].mean(), 2)
        average_completeness = round(completeness_df['data_entries'].mean(), 2)
        average_error = round(error_df['error'].mean(), 2)

        # Calculate completeness categories
        optimal_count = completeness_df[completeness_df['data_entries'] > 18].shape[0]
        good_count = completeness_df[(completeness_df['data_entries'] >= 15) & (completeness_df['data_entries'] <= 18)].shape[0]
        fair_count = completeness_df[(completeness_df['data_entries'] >= 10) & (completeness_df['data_entries'] <= 14)].shape[0]
        poor_count = completeness_df[(completeness_df['data_entries'] >= 1) & (completeness_df['data_entries'] <= 9)].shape[0]

        # Append results to lists
        device_list.append(device_number)
        optimal_completeness_lst.append(optimal_count)
        good_completeness_lst.append(good_count)
        fair_completeness_lst.append(fair_count)
        poor_completeness_lst.append(poor_count)
        air_qloud_lst.append(device_df[air_qloud_literal].unique()[0])

      # Create final DataFrame to return
      result_df = pd.DataFrame({
        device_number_literal: device_list,
        optimal_completeness_literal: optimal_completeness_lst,
        good_completeness_literal: good_completeness_lst,
        fair_completeness_literal: fair_completeness_lst,
        poor_completeness_literal: poor_completeness_lst,
        air_qloud_literal: air_qloud_lst
      })

      # this is reducted code : merged_df = daily_completeness.merge(df[[device_number_literal, air_qloud_literal]].drop_duplicates(), on=device_number_literal)
      result_df = aq_data.merge(result_df[[device_number_literal, optimal_completeness_literal, good_completeness_literal, fair_completeness_literal, poor_completeness_literal
      ]].drop_duplicates(), on=device_number_literal, how='outer')
      result_df.fillna(0, inplace=True)
      result_df['Downtime'] = analysis_duration_hours - (result_df[optimal_completeness_literal] + result_df[good_completeness_literal] + result_df[fair_completeness_literal] + result_df[poor_completeness_literal])
      result_df.drop(columns=['Read Key', 'Device ID' ], inplace=True)

      airqlouds = df[air_qloud_literal].unique()
      num_airqlouds = len(airqlouds)

      num_cols = 2  # Two pie charts per row
      num_rows = (num_airqlouds + 1) // 2  # Number of rows required
      fig = make_subplots(rows=num_rows, cols=num_cols, subplot_titles=airqlouds, specs=[[{'type':'pie'}, {'type':'pie'}]] * num_rows)

      for i, airqloud in enumerate(airqlouds):
        airqloud_df = result_df[result_df[air_qloud_literal] == airqloud]

        labels = ['Optimal', 'Good', 'Fair', 'Poor', 'Downtime']
        values = [airqloud_df[optimal_completeness_literal].sum(), airqloud_df[good_completeness_literal].sum(), airqloud_df[fair_completeness_literal].sum(), airqloud_df[poor_completeness_literal].sum(), airqloud_df['Downtime'].sum()]
        colors = ['green', 'yellow', 'orange', 'crimson', 'grey']

        row = i // num_cols + 1
        col = i % num_cols + 1
        fig.add_trace(go.Pie(labels=labels, values=values, hole=0.3, marker=dict(colors=colors)), row=row, col=col)

      fig.update_layout(title="AirQloud Completeness Performance", title_font_size=20, height=400*num_rows, width=600*num_cols)

      fig.show(renderer="colab")

    else:
      return no_air_qlouds_selected_literal
# air_qloud_completeness(final_df, start, end, aq_data, air_qlouds, device_names)


"""# Done"""
print("Powered by: AirQo")
# print("Made by Gibson")