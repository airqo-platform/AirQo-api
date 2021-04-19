import numpy as np
import pandas as pd

import matplotlib.pyplot as plt

from math import sqrt
from numpy import split, array
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

import ast
import logging
from helpers import utils
from models  import processing 
from models import datamanagement
from dotenv import load_dotenv
import os
from pymongo import MongoClient


_logger = logging.getLogger(__name__)

load_dotenv()

MONGO_URI = os.getenv('MONGO_URI')

def connect_mongo():
    client = MongoClient(MONGO_URI)
    db=client['airqo_netmanager_staging']
    return db


def get_next_24hr_predictions_for_channel(channel_id,prediction_start_time):
    db = connect_mongo()
    print(prediction_start_time)
    print(type(prediction_start_time))
    prediction_start_time = utils.str_to_date(prediction_start_time)
    #channel_predictions = list(db.predictions.find(
            #{'$and': [{'channel_id':  channel_id},
             #{'created_at': {'$gte': prediction_start_time}}]},{'_id': 0}).sort([('$natural', -1)]).limit(1))
    
    #query = {'$match': {'channel_id': channel_id}}
    #projection =  {'$project':{'_id': 0}}
    #sort_order = {'$sort': {'$natural', -1}}
    channel_predictions = list(db.predictions.find(
            {'channel_id': channel_id
                            },{'_id': 0}).sort([('$natural', -1)]).limit(1))
    
    #channel_predictions = list(db.predictions.aggregate(
                #[query, projection]))
    
    results = []
    if len(channel_predictions) > 0:        
        for i in range(0, len(channel_predictions[0]['predictions'])):
            prediction_datetime = channel_predictions[0]['prediction_time'][i]
            prediction_value = channel_predictions[0]['predictions'][i]
            result = {'prediction_time':prediction_datetime, 'prediction_value':prediction_value,
             'lower_ci':0,'upper_ci':0}
            results.append(result)

    formated_results = {'predictions':results}
    return formated_results
    
    

def make_prediction_using_averages_for_all_locations(entered_chan, entered_time, entered_latitude, entered_longitude):
    """
        Generating predictions based on channel and time entered
        saves the predictions in database and returns the predictions
    """
    channels_with_out_predictions =[]

    start_pred_time = (pd.to_datetime(entered_time))
    current_best_config = datamanagement.get_channel_best_configurations(entered_chan)
    #to de removed #
    print(current_best_config) 

    start_pred = (pd.to_datetime(start_pred_time))
    # generating list of hours based on start time
    fcst_hours, start_hour = processing.forecast_hours(start_pred_time)
    selected_channel_id = int(entered_chan)
    
    data = datamanagement.get_channel_data_raw(selected_channel_id) 
    
    hourly_data = datamanagement.calculate_hourly_averages(data)
    all_channel_data = hourly_data
    if all_channel_data.empty:
        results = {'predictions':0, 'channel_id': selected_channel_id, 'errors':'no data available for this channel'}
        channels_with_out_predictions.append(results)
        
    else:
        all_channel_data_clean = fill_gaps_and_set_datetime(all_channel_data)
        all_channel_data_clean.to_csv('all_channel_data_clean'+ str(selected_channel_id)+'.csv')
        
        if not current_best_config:
            results = {'predictions':0, 'errors':'no configurations for this location'}  
            channels_with_out_predictions.append(results)
                     
        else:
            best_number_of_days_back = int(current_best_config[0].get('number_of_days_to_use'))
            considered_hours = int(current_best_config[0].get('considered_hours'))
            
            start_base_time = str(start_pred - datetime.timedelta(best_number_of_days_back)) +'+3:00'
            start_pred = str(start_pred) +'+3:00'
            print(start_base_time +'\t\t start pred:'+ start_pred)
            
            # select final range of data to be used in forecast
            data_to_use = all_channel_data_clean.loc[start_base_time:start_pred].values
            pd.DataFrame(data_to_use).to_csv("data_to_use"+str(selected_channel_id)+".csv")
            print('length of data to use: \n')
            print(len(data_to_use))

            if len(data_to_use)== 0:
                results = {'predictions':0, 'errors':'no predictions, check status of the device at this location', 'channel_id': selected_channel_id}
                channels_with_out_predictions.append(results)
            else:
                # generating mean, lower ci, upper ci
                yhat_24, lower_ci, upper_ci = simple_forecast_ci(data_to_use, best_number_of_days_back, considered_hours)
            
                model_predictions = []
                model_name  =  'simple_average_prediction'
                channel_id =  selected_channel_id   
                location_name =  " "   
                location_latitude = float(entered_latitude)
                location_longitude = float(entered_longitude)
                prediction_start_datetime= pd.to_datetime(start_pred) 
                created_at = datetime.datetime.now() 
                result_modified= []

                for i in range(0, len(yhat_24)):
                    hour_to_add = i+1
                    prediction_value = yhat_24[i]             
                    prediction_datetime = pd.to_datetime(prediction_start_datetime + datetime.timedelta(hours=hour_to_add)) 
                   
                    lower_confidence_interval_value=  lower_ci[i] 
                    upper_confidence_interval_value = upper_ci[i]
                    resultx = {'prediction_time':prediction_datetime, 'prediction_value':prediction_value,
                     'lower_ci':lower_confidence_interval_value,'upper_ci':upper_confidence_interval_value}
                    result_modified.append(resultx)
                
                    model_predictions_tuple = (model_name, channel_id, location_name, location_latitude, location_longitude, 
                    prediction_value, prediction_start_datetime, prediction_datetime, lower_confidence_interval_value, 
                    upper_confidence_interval_value, created_at)
                    model_predictions.append(model_predictions_tuple)          
                
                results ={'prediction_start_time':start_pred, 'prediction_hours': fcst_hours,
                'predictions':yhat_24, 'prediction_upper_ci':upper_ci,'prediction_lower_ci':lower_ci}

                formated_results = {'predictions':result_modified}
                print(formated_results)
                #datamanagement.save_predictions_all(model_predictions)
                _logger.info(f'Predictions: {results}')
                return formated_results

def make_24hr_predictions_for_specified_locations(specified_locations, entered_time):
    """
        makes the 24 hour predictions for all the locations(channels) and saves them in db.
    """
    all_channel_predictions=[]
    #specified_locations = dm.get_all_static_channels()
    #entered_time =datetime.datetime.now()
    if specified_locations:
        for i in range(0, len(specified_locations)):
            channel_id = specified_locations[i].get('channel_id')
            latitude = specified_locations[i].get('latitude')
            longitude = specified_locations[i].get('longitude')
            #print statement below to be removed
            print(channel_id, latitude,longitude)
            results = make_prediction_using_averages_for_all_locations(channel_id, entered_time, latitude, longitude)
            all_channel_predictions.append(results)
    return all_channel_predictions


def get_channel_with_coordinates(latitude, longitude) -> int:
    channel_id = 0
    ### return channel with the specified latitude and longitude
    hourly_data = datamanagement.get_all_channels_hourly_data()
    #hourly_data = datamanagement.calculate_hourly_averages(data)
    channel_id = hourly_data.loc[hourly_data.latitude == latitude and hourly_data.longitude][0]
    return channel_id

def make_prediction_using_averages(entered_chan, entered_time, entered_latitude, entered_longitude):
    """
        Generating predictions based on channel and time entered
        saves the predictions in database and returns the predictions
    """

    start_pred_time = entered_time
    current_best_config = datamanagement.get_channel_best_configurations(entered_chan)
    
    start_pred = (pd.to_datetime(start_pred_time))
    # generating list of hours based on start time
    fcst_hours, start_hour = processing.forecast_hours(start_pred_time)
    selected_channel_id = int(entered_chan)
    print(selected_channel_id)
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
        model_predictions = []
        model_name  =  'simple_average_prediction'
        channel_id =  selected_channel_id   
        location_name =  " "   
        location_latitude = float(entered_latitude)
        location_longitude = float(entered_longitude)
        prediction_start_datetime= pd.to_datetime(start_pred) 
        created_at = datetime.datetime.now() 
        result_modified= [];

        for i in range(0, len(yhat_24)):
            hour_to_add = i+1
            prediction_value = yhat_24[i]             
            prediction_datetime = pd.to_datetime(prediction_start_datetime + datetime.timedelta(hours=hour_to_add)) 
           
            lower_confidence_interval_value=  lower_ci[i] 
            upper_confidence_interval_value = upper_ci[i]
            resultx = {'prediction_time':prediction_datetime, 'prediction_value':prediction_value,
             'lower_ci':lower_confidence_interval_value,'upper_ci':upper_confidence_interval_value}
            result_modified.append(resultx)
        
            model_predictions_tuple = (model_name, channel_id, location_name, location_latitude, location_longitude, 
            prediction_value, prediction_start_datetime, prediction_datetime, lower_confidence_interval_value, 
            upper_confidence_interval_value, created_at)
            model_predictions.append(model_predictions_tuple)          
        
        results ={'prediction_start_time':start_pred, 'prediction_hours': fcst_hours,
        'predictions':yhat_24, 'prediction_upper_ci':upper_ci,'prediction_lower_ci':lower_ci}

        formated_results = {'predictions':result_modified}
        datamanagement.save_predictions(model_predictions)
        _logger.info(f'Predictions: {results}')
        return formated_results


def make_prediction(enter_chan, enter_time) -> dict:
    """Make a prediction using the saved best configurations."""
    #validated_data = validate_inputs(input_data=data)

    enter_time_split = enter_time.split("/")
    enter_time_tuple = tuple([int(i) for i in enter_time_split])
    endings = (0,0,0,0,0,)
    start_time = (enter_time_tuple + endings)
    start_pred_time = datetime.datetime.fromtimestamp(time.mktime(start_time))
    
    #current_best_config = model_config.BEST_CONFIG_DICT.get(str(enter_chan))
    current_best_config = datamanagement.get_channel_best_configurations(enter_chan)

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


def fill_gaps_and_set_datetime(d):
    """
         interpolating, removing nans and dropping columns
    """
    # Interpolating gaps within the data
    #d['time'] = pd.to_datetime(d['time'])
    d.time = pd.to_datetime(d.time)
    #print('datatypes',d.dtypes)
    d = d.set_index('time')
    d = d.drop('channel_id', axis=1)
    d_cleaned = d.interpolate(method='time');
    cleaned_data =  d_cleaned.dropna();
    return cleaned_data

# sarima forecast
# Takes the history (train set plus day by day testing) and configuration
# converts history values to a single long series
# generates the sarima model based on config parameters
# fits the sarima model to the series data
# creates yhat, a prediction of the next 24 hours int he test set
def sarima_forecast(history, config):
    order, sorder, trend = config
    # convert history into a univariate series
    series = to_series(history)
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


def to_series(data):
    """
    convert windows of weekly multivariate data into a series of total power.
    flatten into a single series
    """
    series = [day for day in data]
    series = array(series).flatten()
    return series


def simple_forecast_ci(history, configs, considered_hours):
    """
        simple forecast function but taking into account confidence intervals
    """
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
            #print (f'Day: {day}')
            #print(f'Hour: {hour}')
            hours_to_count = -(hour+ day*24) 
            #print(f'Hours to count:{hours_to_count}')       
            hourly_values = series[hours_to_count]
            #print(f'Hourly values: {hourly_values}')
            list_of_hours_to_count.append(hours_to_count)
            list_of_hourly_values.append(hourly_values)
            print(f'Hourly values list: {list_of_hourly_values}')
        #print('list of hourly values')
        #print(list_of_hourly_values)

        #print('list of hours to count')
        #print(list_of_hours_to_count)
        mean_of_hourly_values, lower_ci_of_hourly_values, upper_ci_of_hourly_values = processing.mean_confidence_interval(list_of_hourly_values, confidence=0.95)

        
        list_of_mean_hourly_values.append(mean_of_hourly_values)
        list_of_lower_ci_of_hourly_values.append(lower_ci_of_hourly_values)
        list_of_upper_ci_of_hourly_values.append(upper_ci_of_hourly_values)

    forecast = np.around(list_of_mean_hourly_values[::-1], decimals=2)
    print(f'Forecast: {forecast}')#delete
    lower_ci_forecast = np.around(list_of_lower_ci_of_hourly_values[::-1], decimals=2)
    print(f'Lower ci: {lower_ci_forecast}')#delete
    upper_ci_forecast = np.around(list_of_upper_ci_of_hourly_values[::-1], decimals=2)
    print(f'Upper ci: {upper_ci_forecast}')#delete

    return forecast, lower_ci_forecast, upper_ci_forecast


if __name__ == '__main__':
    #make_prediction("aq_24","2019/07/10/10")
    #load_json_data(model_config.BEST_CONFIG_FROM_AVERAGES_MODEL)
    #entered_time = datetime.datetime.now()
    entered_time = datetime.datetime.now() - datetime.timedelta(hours = 1)
    entered_time = entered_time.strftime('%Y-%m-%d %H:%M')
    print(entered_time)
    specified_locations = datamanagement.get_all_static_channels()
    all_channel_predictions = make_24hr_predictions_for_specified_locations(specified_locations, entered_time)
    #all_channel_predictions =  make_24hr_predictions_for_specified_locations(entered_time)

