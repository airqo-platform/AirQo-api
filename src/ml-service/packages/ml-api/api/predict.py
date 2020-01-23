import numpy as np
import pandas as pd

import matplotlib.pyplot as plt

from math import sqrt
from numpy import split
from numpy import array
from pandas import read_csv
from sklearn.metrics import mean_squared_error
from multiprocessing import cpu_count
from joblib import Parallel
from joblib import delayed

from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.graphics.tsaplots import plot_pacf

import warnings

import datetime
import time 

import psutil
import ast
from api import model_config
#import model_config
import logging
from api import utils
from api import processing 
from api import datamanagement

_logger = logging.getLogger(__name__)

warnings.filterwarnings("ignore")


def get_channel_with_coordinates(latitude, longitude) -> int:
    channel_id = 0
    ### return channel with the specified latitude and longitude
    hourly_data = datamanagement.get_all_channels_hourly_data()
    #hourly_data = datamanagement.calculate_hourly_averages(data)
    channel_id = hourly_data.loc[hourly_data.latitude == latitude and hourly_data.longitude][0]
    return channel_id

# Generating forecast based on channel and time entered
def make_prediction_using_averages(entered_chan, entered_time,entered_latitude,entered_longitude):

    start_pred_time = entered_time
    current_best_config = datamanagement.get_channel_best_configurations(entered_chan)
    
    start_pred = (pd.to_datetime(start_pred_time))
    # generating list of hours based on start time
    fcst_hours, start_hour = processing.forecast_hours(start_pred_time)
    selected_channel_id = int(entered_chan)
    #hourly_data = datamanagement.get_channel_hourly_data(selected_channel_id)
    #data = datamanagement.get_channel_data(selected_channel_id) 
    data = datamanagement.get_channel_data_raw(selected_channel_id) 
    
    hourly_data = datamanagement.calculate_hourly_averages(data)
    all_channel_data = hourly_data
    if all_channel_data.empty:
        results = {'predictions':0}
        return results
    else:
        all_channel_data_clean = fill_gaps_and_set_datetime(all_channel_data)
        
        if not current_best_config:
            best_number_of_days_back = ast.literal_eval(current_best_config[0])[0] 
            config_to_use = ast.literal_eval(current_best_config[0])
        else:
            best_number_of_days_back = int(current_best_config[0].get('number_of_days_to_use'))
            considered_hours = int(current_best_config[0].get('considered_hours'))
            
        start_base_time = str(start_pred - datetime.timedelta(best_number_of_days_back)) +'+3:00'
        start_pred = str(start_pred) +'+3:00'
        
        
        # select final range of data to be used in forecast
        data_to_use = all_channel_data_clean.loc[start_base_time:start_pred].values

        # generating mean, lower ci, upper ci
        yhat_24, lower_ci, upper_ci = simple_forecast_ci(data_to_use, best_number_of_days_back, considered_hours)

        #results ={'prediction_start_time':start_pred, 'prediction_hours': fcst_hours,
        #'predictions':yhat_24.tolist(), 'prediction_upper_ci':upper_ci.tolist(), 
        #'prediction_lower_ci':lower_ci.tolist()}

        
        model_predictions = []
        model_name  =  'simple_average_prediction'
        channel_id =  selected_channel_id   
        location_name =  ""   
        location_latitude = entered_latitude
        location_longitude = entered_longitude
        prediction_start_datetime= pd.to_datetime(start_pred) 
        print(prediction_start_datetime)
        type(prediction_start_datetime)
        created_at = datetime.datetime.now() 
        result_modified= [];

        for i in range(0, len(yhat_24)):
            hour_to_add = i+1
            prediction_value = yhat_24[i]             
            prediction_datetime = pd.to_datetime(prediction_start_datetime + datetime.timedelta(hours=hour_to_add)) 
            print(prediction_datetime)
            print(type(prediction_datetime))

            lower_confidence_interval_value=  lower_ci[i] 
            upper_confidence_interval_value = upper_ci[i]
            resultx = {'prediction_time':prediction_datetime, 'prediction_value':prediction_value, 'lower_ci':lower_confidence_interval_value,'upper_ci':upper_confidence_interval_value}
            result_modified.append(resultx)
        
        model_predictions_tuple = (model_name,channel_id, location_name, location_latitude, location_longitude, prediction_value, prediction_start_datetime, prediction_datetime, created_at, lower_confidence_interval_value,upper_confidence_interval_value)
        model_predictions.append(model_predictions_tuple)  
        print(model_predictions)

        
        
        results ={'prediction_start_time':start_pred, 'prediction_hours': fcst_hours,
        'predictions':yhat_24, 'prediction_upper_ci':upper_ci, 
        'prediction_lower_ci':lower_ci}
        formated_results = {'predictions':result_modified}
        #datamanagement.save_predictions(model_predictions)
        _logger.info(f'Predictions: {results}')
        #save these in database
        #utils.save_json_data('results.json', results)
        return  results, formated_results


def make_prediction(enter_chan, enter_time) -> dict:
    """Make a prediction using the saved best configurations."""
    #validated_data = validate_inputs(input_data=data)

    enter_time_split = enter_time.split("/")
    enter_time_tuple = tuple([int(i) for i in enter_time_split])
    endings = (0,0,0,0,0,)
    start_time = (enter_time_tuple + endings)
    start_pred_time = datetime.datetime.fromtimestamp(time.mktime(start_time))
    
    current_best_config = model_config.BEST_CONFIG_DICT.get(str(enter_chan))

    start_pred = (pd.to_datetime(start_pred_time))

    hourly_data = datamanagement.get_all_channels_hourly_data()
    #hourly_data = datamanagement.calculate_hourly_averages(data)
    # select all data relating to a particular channel
    all_channel_data = hourly_data.loc[hourly_data.channel_id == enter_chan]

    # clean the channel data, fill gaps and set datetime as index
    all_channel_data_clean = fill_gaps_and_set_datetime(all_channel_data)

    # set start time as being 8 weeks before start of forecast
    # THis will need to be changed to max number of whole days

    start_base_time = str(start_pred - datetime.timedelta(84)) +'+3:00'
    start_pred = str(start_pred) +'+3:00'
    #print((start_base_time))
    #print((start_pred))
    # select final range of data to be used in forecast
    data_to_use = all_channel_data_clean.loc[start_base_time:(start_pred)].values

    yhat, yhat_ci = sarima_forecast(data_to_use, current_best_config)
    results ={'prediction time':start_pred, 'predictions':yhat.tolist(), 'prediction_ci':yhat_ci.tolist()}
    
    _logger.info(f'Predictions: {results}')

    return results

# interpolating, removing nans and dropping columns
def fill_gaps_and_set_datetime(d):
    # Interpolating gaps within the data
    #d['time'] = pd.to_datetime(d['time'])
    d.time = pd.to_datetime(d.time)
    print('datatypes',d.dtypes)
    d = d.set_index('time')
    d = d.drop('channel_id', axis=1)
    d_cleaned = d.interpolate(method='time');

    return d_cleaned

# sarima forecast
# Takes the history (train set plus day by day testing) and configuration
# converts history values to a single long series
# generates the sarima model based on config parameters
# fits the sarima model to the series data
# creates yhat, a prediction of the next 24 hours int he test set
def sarima_forecast(history, config):
    order, sorder, trend = config
    # convert history into a univariate series
    series = to_seriesx(history)
    # define model
    model = SARIMAX(series, order=order, seasonal_order=sorder, trend = trend,enforce_stationarity=False, enforce_invertibility=False)
#     model = SARIMAX(history, order=order, seasonal_order=sorder, trend=trend, enforce_stationarity=False, enforce_invertibility=False)
    # fit model
    model_fit = model.fit(disp=False)
    # make one step forecast using predict method
#     yhat = model_fit.predict(len(series), len(series)+23)
    # This does th same thing but using forecast which has slightly different features
    fcst = model_fit.get_forecast(24)
    # Generating list of mean forecasts
    yhat = fcst.predicted_mean
    # Generating confidence intervals
    yhat_ci = fcst.conf_int()
    return yhat, yhat_ci


# convert windows of weekly multivariate data into a series of total power
def to_series(data):
    series = [day for day in data]
    print("series:", series)
    # flatten into a single series
    series = array(series).flatten()
    print(series)
    return series


# rerunning the simple forecast function but taking into account confidence intervals
def simple_forecast_ci(history, configs, considered_hours):
    list_of_mean_hourly_values = []
    list_of_lower_ci_of_hourly_values = []
    list_of_upper_ci_of_hourly_values = []
    days = configs
    hours = considered_hours
    # convert to a single list of values
    series = to_series(history)
    
    # for each hour in 24 calcute the mean value for that hour on each days for which data is available
    for hour in (np.arange(1, (hours+1))):
        list_of_hours_to_count = []
        list_of_hourly_values = []
        for day in (np.arange(0, (days))):
            hours_to_count = -(hour+ day*24)
            print(hours_to_count)
            hourly_values = series[hours_to_count]
            list_of_hours_to_count.append(hours_to_count)
            list_of_hourly_values.append(hourly_values)
        # take the mean and confidence
        mean_of_hourly_values, lower_ci_of_hourly_values, upper_ci_of_hourly_values = processing.mean_confidence_interval(list_of_hourly_values, confidence=0.95)

        
        list_of_mean_hourly_values.append(mean_of_hourly_values)
        list_of_lower_ci_of_hourly_values.append(lower_ci_of_hourly_values)
        list_of_upper_ci_of_hourly_values.append(upper_ci_of_hourly_values)

    forecast = list_of_mean_hourly_values[::-1]
    lower_ci_forecast = list_of_lower_ci_of_hourly_values[::-1]
    upper_ci_forecast = list_of_upper_ci_of_hourly_values[::-1]

    return forecast, lower_ci_forecast, upper_ci_forecast




#def validate_inputs(input_data)

if __name__ == '__main__':
    #make_prediction("aq_24","2019/07/10/10")
    #load_json_data(model_config.BEST_CONFIG_FROM_AVERAGES_MODEL)
    make_prediction_using_averages(782721, '2019/12/10/09')

