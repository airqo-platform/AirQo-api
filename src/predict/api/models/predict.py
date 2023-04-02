import logging

from config.constants import connect_mongo

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
            result = {'forecast_day': forecast_day, 'forecast': forecast_value}
            results.append(result)

    formatted_results = {'forecasts': results}
    return formatted_results
