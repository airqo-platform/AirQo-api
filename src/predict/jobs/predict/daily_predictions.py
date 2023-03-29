import joblib
import numpy as np
import pandas as pd

from config import connect_mongo, configuration
from transform import get_forecast_data

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

    return df_tmp


def get_other_features(df_tmp):
    D_COL = 'created_at'
    attributes = ['year', 'month', 'day', 'dayofweek']
    for a in attributes:
        df_tmp[a] = df_tmp['created_at'].dt.__getattribute__(a)

    df_tmp['week'] = df_tmp['created_at'].dt.isocalendar().week
    return df_tmp


def preprocess_forecast_data(target_column):
    # getting forecast data
    forecast_data = get_forecast_data()
    # convert 'device_number' to string
    forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'], format='%Y-%m-%d')
    forecast_data.set_index('created_at', inplace=True)
    forecast_data['device_number'] = forecast_data['device_number'].astype(str)
    forecast_data = forecast_data.groupby(
        ['device_number']).resample('D').mean(numeric_only=True)
    forecast_data = forecast_data.reset_index()
    forecast_data.sort_values(by=['device_number', 'created_at'], inplace=True)
    forecast_data['device_number'] = forecast_data['device_number'].astype(int)
    forecast_data.dropna(subset=['pm2_5'], inplace=True)
    forecast_data = get_lag_features(forecast_data, target_column)
    forecast_data = get_other_features(forecast_data)

    return forecast_data


def get_new_row(df_tmp, device, model):
    last_row = df_tmp[df_tmp["device_number"] == device].iloc[-1]
    new_row = pd.Series(index=last_row.index, dtype='float64')
    new_row["created_at"] = last_row["created_at"] + pd.Timedelta(days=1)
    new_row["device_number"] = device
    new_row["pm2_5"] = model.predict(last_row.drop(["created_at", "pm2_5"]).values.reshape(1, -1))[0]
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
    return new_row


def get_next_1week_predictions(target_column, model):
    print(configuration.TEST_DATE_DAILY_START)
    print(configuration.TEST_DATE_DAILY_END)

    forecast_data = preprocess_forecast_data(target_column)
    test_forecast_data = forecast_data.copy()
    horizon = 7
    next_1week_predictions = pd.DataFrame()

    for device in test_forecast_data["device_number"].unique():
        test_copy = test_forecast_data[test_forecast_data["device_number"] == device].copy()
        for i in range(horizon):
            new_row = get_new_row(test_copy, device, model)
            test_copy = pd.concat([test_copy, new_row.to_frame().T], ignore_index=True)
        # Append the forecast for the current device to the forecasts dataframe
        next_1week_predictions = pd.concat([next_1week_predictions, test_copy], ignore_index=True)

    return next_1week_predictions


if __name__ == '__main__':
    TARGET_COL = 'pm2_5'
    model = joblib.load("/Users/mutabazinble/GitHub/AirQo-api/src/predict/jobs/train/LGBMmodel.pkl")
    forecasts = get_next_1week_predictions(TARGET_COL, model)
    print(forecasts)
    # all_channels_x = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID,
    #                                             configuration.AIRQO_PREDICT_BUCKET, 'all_channels.pkl')
    # prediction_results = []
    #
    # created_at = str_to_date_2(date_to_str_2(datetime.now()))
    # for channel_id in all_channels_x:
    #     result = get_predictions_for_channel(next_1week_predictions, channel_id)
    #     record = {'channel_id': int(channel_id), 'predictions': result['preds'].tolist(),
    #               'created_at': created_at, 'prediction_time': result['created_at'].tolist()}
    #     prediction_results.append(record)
    #
    # save_next_24hrs_prediction_results(prediction_results)
