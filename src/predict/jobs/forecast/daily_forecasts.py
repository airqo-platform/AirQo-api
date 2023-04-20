from datetime import datetime

import numpy as np
import pandas as pd

from config import connect_mongo, configuration
from models import Events
from utils import get_trained_model_from_gcs

db = connect_mongo()


def get_lag_features(df_tmp, TARGET_COL):
    df_tmp = df_tmp.sort_values(by=['device_number', 'created_at'])
    shifts = [1, 2]
    for s in shifts:
        df_tmp[f'pm2_5_last_{s}_day'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(s)
    shifts = [3, 7, 14, 30]
    functions = ['mean', 'std', 'max', 'min']
    for s in shifts:
        for f in functions:
            df_tmp[f'pm2_5_{f}_{s}_day'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(1).rolling(s).agg(f)
    print("Adding lag features")
    return df_tmp


def get_other_features(df_tmp):
    attributes = ['year', 'month', 'day', 'dayofweek']
    for a in attributes:
        df_tmp[a] = df_tmp['created_at'].dt.__getattribute__(a)

    df_tmp['week'] = df_tmp['created_at'].dt.isocalendar().week
    print("Adding other features")
    return df_tmp


def preprocess_forecast_data(target_column):
    """preprocess data before making forecasts"""

    # TODO: Eventually move to events API instead of bigquery
    forecast_data = Events.fetch_bigquery_data()
    forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'], format='%Y-%m-%d')
    forecast_data = forecast_data[pd.to_numeric(forecast_data['device_number'], errors='coerce').notnull()]
    forecast_data['device_number'] = forecast_data['device_number'].astype(str)
    forecast_data = forecast_data.dropna(subset=['device_number'])
    forecast_data = forecast_data.groupby(
        ['site_id', 'device_number']).resample('D', on='created_at').mean(numeric_only=True)
    forecast_data = forecast_data.reset_index()
    forecast_data.sort_values(by=['site_id', 'device_number', 'created_at'], inplace=True)

    forecast_data['device_number'] = forecast_data['device_number'].astype(int)
    forecast_data.dropna(subset=['pm2_5'], inplace=True)

    # Add lag features
    forecast_data = get_lag_features(forecast_data, target_column)
    forecast_data = get_other_features(forecast_data)
    print('preprocess_forecast_data completed')
    return forecast_data


def get_new_row(df_tmp, device, model):
    last_row = df_tmp[df_tmp["device_number"] == device].iloc[-1]
    new_row = pd.Series(index=last_row.index, dtype='float64')
    new_row["site_id"] = last_row["site_id"]
    new_row["created_at"] = last_row["created_at"] + pd.Timedelta(days=1)
    new_row["device_number"] = device
    new_row[f'pm2_5_last_1_day'] = last_row["pm2_5"]
    new_row[f'pm2_5_last_2_day'] = last_row[f'pm2_5_last_{1}_day']
    shifts = [3, 7, 14, 30]
    functions = ['mean', 'std', 'max', 'min']
    for s in shifts:
        for f in functions:
            if f == 'mean':
                new_row[f'pm2_5_{f}_{s}_day'] = (last_row["pm2_5"] + last_row[f'pm2_5_{f}_{s}_day'] * (s - 1)) / s
            elif f == 'std':
                new_row[f'pm2_5_{f}_{s}_day'] = np.sqrt((last_row["pm2_5"] - last_row[f'pm2_5_mean_{s}_day']) ** 2 + (
                        last_row[f'pm2_5_{f}_{s}_day'] ** 2 * (s - 1))) / s
            elif f == 'max':
                new_row[f'pm2_5_{f}_{s}_day'] = max(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_day'])
            elif f == 'min':
                new_row[f'pm2_5_{f}_{s}_day'] = min(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_day'])

                # Use the date of the new row to create other features
    attributes = ['year', 'month', 'day', 'dayofweek']
    for a in attributes:
        new_row[a] = new_row['created_at'].__getattribute__(a)
        new_row['week'] = new_row["created_at"].isocalendar().week

    new_row["pm2_5"] = model.predict(new_row.drop(["created_at", "pm2_5", "site_id"]).values.reshape(1, -1))[0]
    return new_row


def save_next_1_week_forecast_results(data):
    db.daily_forecasts.insert_many(data)
    print('saved')


def get_next_1week_forecasts(target_column, model):
    print('Getting next 1 week forecasts')
    forecast_data = preprocess_forecast_data(target_column)
    test_forecast_data = forecast_data.copy()
    forecast_horizon = 7  # number of days to forecast
    next_1week_forecasts = pd.DataFrame()

    for device in test_forecast_data["device_number"].unique():
        test_copy = test_forecast_data[test_forecast_data["device_number"] == device]
        for i in range(forecast_horizon):
            new_row = get_new_row(test_copy, device, model)
            test_copy = pd.concat([test_copy, new_row.to_frame().T], ignore_index=True)
        next_1week_forecasts = pd.concat([next_1week_forecasts, test_copy], ignore_index=True)

    next_1week_forecasts['device_number'] = next_1week_forecasts['device_number'].astype(int)
    next_1week_forecasts['pm2_5'] = next_1week_forecasts['pm2_5'].astype(float)
    return next_1week_forecasts[['site_id', 'created_at', 'pm2_5', 'device_number']][
        next_1week_forecasts['created_at'] > configuration.TEST_DATE_DAILY_START]


if __name__ == '__main__':
    TARGET_COL = 'pm2_5'
    model = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.AIRQO_PREDICT_BUCKET,
                                       'daily_forecast_model.pkl')
    forecasts = get_next_1week_forecasts(TARGET_COL, model)
    forecasts['created_at'] = forecasts['created_at'].apply(lambda x: x.isoformat())
    forecast_results = []

    created_at = pd.to_datetime(datetime.now()).isoformat()

    for i in forecasts['device_number'].unique():
        record = {'channel_id': int(i),
                  'site_id': forecasts[forecasts['device_number'] == i]['site_id'].tolist()[0],
                  'pm2_5': forecasts[forecasts['device_number'] == i]['pm2_5'].tolist(),
                  'created_at': created_at,
                  'time': forecasts[forecasts['device_number'] == i]['created_at'].tolist()}
        forecast_results.append(record)

    save_next_1_week_forecast_results(forecast_results)
