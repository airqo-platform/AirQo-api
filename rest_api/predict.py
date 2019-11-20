
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


from math import sqrt
from numpy import split
from numpy import array
from pandas import read_csv
from sklearn.metrics import mean_squared_error

from multiprocessing import cpu_count
from joblib import Parallel
from joblib import delayed
from warnings import catch_warnings
from warnings import filterwarnings
from statsmodels.tsa.statespace.sarimax import SARIMAX

from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.graphics.tsaplots import plot_pacf

import datetime
import time

import psutil
import ast






hourly_data = pd.read_csv('hourly_data_AUG_19.csv', parse_dates=['time'])



best_config_dict = {'aq_22': [(2, 0, 24), (1, 0, 1, 24), 'c'] , 'aq_23': [(2, 0, 24), (0, 0, 1, 24), 'c'], 'aq_24': [(5, 0, 24), (0, 0, 0, 24), 'c'] }



def make_prediction(enter_chan, enter_time) -> dict:
    """Make a prediction using the saved best configurations."""
    #validated_data = validate_inputs(input_data=data)
    enter_time_split = enter_time.split('/')
    enter_time_tuple = tuple([int(i) for i in enter_time_split])
    endings = (0,0,0,0,0,)
    start_time = (enter_time_tuple + endings)
    start_pred_time = datetime.datetime.fromtimestamp(time.mktime(start_time))

    current_best_config = best_config_dict.get(str(enter_chan))

    start_pred = (pd.to_datetime(start_pred_time))

    # select all data relating to a particular channel
    all_channel_data = hourly_data.loc[hourly_data.channel == enter_chan]

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

    #_logger.info(f'Predictions: {results}')

    return results

#current_best_config = best_config_dict.get(str(enter_chan))
#print(current_best_config)




# interpolating, removing nans and dropping columns
def fill_gaps_and_set_datetime(d):
    # Interpolating gaps within the data
    d = d.set_index('time')
    d = d.drop('channel', axis=1)
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





# convert windows of weekly multivariate data into a series of total power
def to_series(data):
    # extract just the total power from each week
    series = [day for day in data]
    # flatten into a single series
    series = array(series).flatten()
#     print('series.shape: ', series.shape)
    return series
#result = make_prediction("aq_22", "2019/07/23/07")
