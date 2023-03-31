import logging

import numpy as np
from numpy import array

from config.constants import connect_mongo
from models import processing

_logger = logging.getLogger(__name__)


def get_next_24hr_forecasts_for_channel(channel_id, forecast_start_time):
    db = connect_mongo()
    print(forecast_start_time)
    print(type(forecast_start_time))
    channel_forecasts = list(db.hourly_forecasts.find(
        {'channel_id': channel_id
         }, {'_id': 0}).sort([('$natural', -1)]).limit(1))
    results = []
    if len(channel_forecasts) > 0:
        for i in range(0, len(channel_forecasts[0]['forecasts'])):
            forecast_datetime = channel_forecasts[0]['forecast_time'][i]
            forecast_value = channel_forecasts[0]['forecasts'][i]
            result = {'forecast_time': forecast_datetime, 'forecast_value': forecast_value}
            results.append(result)

    formated_results = {'forecasts': results}
    return formated_results


def get_next_1_week_forecasts_for_channel(channel_id, forecast_start_date):
    db = connect_mongo()
    print(forecast_start_date)
    print(type(forecast_start_date))

    channel_forecasts = list(db.daily_forecasts.find(
        {'channel_id': channel_id
         }, {'_id': 0}).sort([('$natural', -1)]).limit(1))

    results = []
    if len(channel_forecasts) > 0:
        for i in range(0, len(channel_forecasts[0]['forecasts'])):
            forecast_day = channel_forecasts[0]['forecast_day'][i]
            forecast_value = channel_forecasts[0]['forecasts'][i]
            result = {'forecast_day': forecast_day, 'forecast': forecast_value,
                      'lower_ci': 0, 'upper_ci': 0}
            results.append(result)

    formatted_results = {'forecasts': results}
    return formatted_results


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
    for hour in (np.arange(1, (hours + 1))):
        list_of_hours_to_count = []
        list_of_hourly_values = []
        for day in (np.arange(0, (days))):
            hours_to_count = -(hour + day * 24)
            hourly_values = series[hours_to_count]
            list_of_hours_to_count.append(hours_to_count)
            list_of_hourly_values.append(hourly_values)
        print('list of hourly values')
        print(list_of_hourly_values)

        print('list of hours to count')
        print(list_of_hours_to_count)
        mean_of_hourly_values, lower_ci_of_hourly_values, upper_ci_of_hourly_values = processing.mean_confidence_interval(
            list_of_hourly_values, confidence=0.95)

        list_of_mean_hourly_values.append(mean_of_hourly_values)
        list_of_lower_ci_of_hourly_values.append(lower_ci_of_hourly_values)
        list_of_upper_ci_of_hourly_values.append(upper_ci_of_hourly_values)

    forecast = np.around(list_of_mean_hourly_values[::-1], decimals=2)
    lower_ci_forecast = np.around(list_of_lower_ci_of_hourly_values[::-1], decimals=2)
    upper_ci_forecast = np.around(list_of_upper_ci_of_hourly_values[::-1], decimals=2)

    return forecast, lower_ci_forecast, upper_ci_forecast
