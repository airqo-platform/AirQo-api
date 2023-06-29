import datetime

import numpy as np
import pandas as pd

from config import connect_mongo, configuration
from models import Events
from utils import get_trained_model_from_gcs

from scipy.stats import skew

db = connect_mongo()
fixed_columns = ['site_id']


def get_lag_features(df_tmp, TARGET_COL):
    df_tmp = df_tmp.sort_values(by=['device_number', 'created_at'])
    shifts = [1, 2]
    for s in shifts:
        df_tmp[f'pm2_5_last_{s}_hour'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(s)

    shifts = [6, 12, 24, 48]
    functions = ['mean', 'std', 'median', 'skew']
    for s in shifts:
        for f in functions:
            df_tmp[f'pm2_5_{f}_{s}_hour'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(1).rolling(s).agg(f)
    print("Adding lag features")
    return df_tmp


def get_other_features(df_tmp):
    attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute']
    for a in attributes:
        df_tmp[a] = df_tmp['created_at'].dt.__getattribute__(a)
    df_tmp['week'] = df_tmp['created_at'].dt.isocalendar().week
    print("Adding other features")
    return df_tmp


def preprocess_forecast_data(target_column):
    """preprocess data before making forecasts"""
    print('preprocess_forecast_data started.....')
    forecast_data = Events.fetch_hourly_bigquery_data()
    forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'])
    forecast_data['pm2_5'] = forecast_data.groupby(fixed_columns + ['device_number'])['pm2_5'].transform(
        lambda x: x.interpolate(method='linear', limit_direction='both'))
    forecast_data = forecast_data.dropna(subset=['pm2_5'])  # no data at all for the device
    forecast_data['device_number'] = forecast_data['device_number'].astype(str)
    forecast_data.sort_values(
        by=fixed_columns + ['device_number',
                            'created_at'], inplace=True)
    forecast_data = get_lag_features(forecast_data, target_column)
    forecast_data = get_other_features(forecast_data)
    print('preprocess_forecast_data completed.....')
    return forecast_data


def get_new_row(df_tmp, device, model):
    last_row = df_tmp[df_tmp["device_number"] == device].iloc[-1]
    new_row = pd.Series(index=last_row.index, dtype='float64')
    for i in fixed_columns:
        new_row[i] = last_row[i]
    new_row["created_at"] = last_row["created_at"] + pd.Timedelta(hours=1)
    new_row["device_number"] = device
    new_row[f'pm2_5_last_1_hour'] = last_row["pm2_5"]
    new_row[f'pm2_5_last_2_hour'] = last_row[f'pm2_5_last_{1}_hour']

    shifts = [6, 12, 24, 48]
    functions = ['mean', 'std', 'median', 'skew']
    for s in shifts:
        for f in functions:
            if f == 'mean':
                new_row[f'pm2_5_{f}_{s}_hour'] = (last_row["pm2_5"] + last_row[f'pm2_5_{f}_{s}_hour'] * (s - 1)) / s
            elif f == 'std':
                new_row[f'pm2_5_{f}_{s}_hour'] = np.sqrt((last_row["pm2_5"] - last_row[f'pm2_5_mean_{s}_hour']) ** 2 + (
                        last_row[f'pm2_5_{f}_{s}_hour'] ** 2 * (s - 1))) / s
            elif f == 'median':
                new_row[f'pm2_5_{f}_{s}_hour'] = np.median(
                    np.append(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_hour']))
            elif f == 'skew':
                new_row[f'pm2_5_{f}_{s}_hour'] = skew(np.append(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_hour']))

    attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute']
    for a in attributes:
        new_row[a] = new_row['created_at'].__getattribute__(a)
        new_row['week'] = new_row["created_at"].isocalendar().week

    new_row["pm2_5"] = \
        model.predict(new_row.drop(
            fixed_columns + ["created_at", "pm2_5"]).values.reshape(1, -1))[0]
    return new_row


def append_health_tips(pm2_5, health_tips):
    tips = []
    if health_tips is None:
        return []
    return list(filter(lambda tip: tip['aqi_category']['min'] <= pm2_5 <= tip['aqi_category']['max'], health_tips))


def save_next_24_hour_forecast_results(data):
    db.hourly_forecasts.insert_many(data)
    print('saved')


def get_next_24_hour_forecasts(target_column, model):
    print('Getting next 24 hour forecasts')
    forecast_data = preprocess_forecast_data(target_column)
    test_forecast_data = forecast_data.copy()
    next_24_hour_forecasts = pd.DataFrame()

    for device in test_forecast_data["device_number"].unique():
        test_copy = test_forecast_data[test_forecast_data["device_number"] == device]
        for i in range(int(configuration.FORECAST_HOURLY_HORIZON)):
            new_row = get_new_row(test_copy, device, model)
            test_copy = pd.concat([test_copy, new_row.to_frame().T], ignore_index=True)
        next_24_hour_forecasts = pd.concat([next_24_hour_forecasts, test_copy], ignore_index=True)

    next_24_hour_forecasts['device_number'] = next_24_hour_forecasts['device_number'].astype(int)
    next_24_hour_forecasts['pm2_5'] = next_24_hour_forecasts['pm2_5'].astype(float)
    next_24_hour_forecasts.rename(columns={'created_at': 'time'}, inplace=True)
    return next_24_hour_forecasts[fixed_columns + ['time', 'pm2_5',
                                                   'device_number']][[next_24_hour_forecasts['time'] >= datetime.datetime.utcnow()]]
if __name__ == '__main__':
    TARGET_COL = 'pm2_5'
    model = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.AIRQO_PREDICT_BUCKET,
                                       'hourly_forecast_model.pkl')
    forecasts = get_next_24_hour_forecasts(TARGET_COL, model)
    forecasts['time'] = forecasts['time'].apply(lambda x: x.isoformat())
    print("Adding health tips")
    health_tips = Events.fetch_health_tips()
    attempts = 1
    while health_tips is None and attempts < 3:
        print(f"Attempt {attempts}: Health tips not found. Trying again...")
        health_tips = Events.fetch_health_tips()
        attempts += 1

    if health_tips is not None:
        forecasts['health_tips'] = forecasts['pm2_5'].apply(lambda x: append_health_tips(x, health_tips))
    else:
        print("Health tips not found after 2 attempts. Continuing with the rest of the program...")
    created_at = pd.to_datetime(datetime.now()).isoformat()
    device_numbers = forecasts['device_number'].unique()
    forecast_results = [
        {
            field: forecasts[forecasts['device_number'] == i][field].tolist()[0]
            if field != 'pm2_5' and field != 'time' and field != 'health_tips'
            else forecasts[forecasts['device_number'] == i][field].tolist()
            for field in forecasts.columns
        }
        | {'created_at': created_at}
        for i in device_numbers
    ]
    print("Saving forecast results")
    save_next_24_hour_forecast_results(forecast_results)
