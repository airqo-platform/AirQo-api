from datetime import datetime
import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from config import connect_mongo, configuration
from models import Events
from utils import (
    get_csv_file_from_gcs,
    get_trained_model_from_gcs,
    date_to_str_2,
    str_to_date_2)

db = connect_mongo()


def preprocess_forecast_data(metadata_path, boundary_layer_path, test_lag_last_date_hour=""):
    # getting metadata
    metadata = preprocess_metadata(metadata_path)

    # getting boundarylayer data
    boundary_layer_mapper = get_boundary_layer_mapper(boundary_layer_path)

    # getting forecast data
    forecast_data = Events.get_forecast_data()

    forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'], format='%Y-%m-%d %H:%M:%S')
    forecast_data['date'] = forecast_data['created_at'].dt.date
    forecast_data = forecast_data[forecast_data['device_number'].isin(metadata['device_number'])].reset_index(drop=True)

    return forecast_data, metadata, boundary_layer_mapper


def preprocess_metadata(METADATA_PATH):
    metadata = get_csv_file_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.AIRQO_PREDICT_BUCKET,
                                     METADATA_PATH)

    fts = [c for c in metadata if c not in ['device_number']]
    cat_fts = metadata[fts].select_dtypes('object').columns.tolist()
    metadata[cat_fts] = metadata[cat_fts].apply(lambda x: pd.factorize(x)[0])

    return metadata


def get_boundary_layer_mapper(BOUNDARY_LAYER_PATH):
    boundary_layer = get_csv_file_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.AIRQO_PREDICT_BUCKET,
                                           BOUNDARY_LAYER_PATH)
    boundary_layer_mapper = pd.Series(index=boundary_layer['hour'], data=boundary_layer['height'])

    return boundary_layer_mapper


def preprocess_df(df_tmp, boundary_layer_mapper, metadata, target_column, n_hrs_back, seq_len, is_test=False):
    df_tmp = get_lag_features(df_tmp, target_column, n_hrs_back, seq_len)
    # print(df_tmp.head())
    df_tmp = get_other_features(df_tmp, boundary_layer_mapper, metadata)
    return df_tmp


def get_lag_features(df_tmp, TARGET_COL, N_HRS_BACK, SEQ_LEN):
    df_tmp = df_tmp.sort_values(by='created_at')

    ### Shift Features
    df_tmp = df_tmp.assign(**{
        f'{TARGET_COL} (t-{t})': df_tmp.groupby('device_number')[TARGET_COL].shift(t)
        for t in range(N_HRS_BACK + SEQ_LEN - 1, N_HRS_BACK - 1, -1)
    })

    FIRST_SHIFT_COL = f'{TARGET_COL} (t-{N_HRS_BACK})'

    ### Rolling Features
    periods = [4, 12, 24, 48, 24 * 7, 24 * 14, 24 * 31]

    for agg_func in ['min', 'max', 'mean', 'std']:
        df_tmp = df_tmp.assign(**{
            f'rolling_{agg_func}_{period}_hrs': df_tmp.groupby('device_number')[FIRST_SHIFT_COL].transform(
                lambda x: x.rolling(period, min_periods=1).agg(agg_func))
            for period in periods
        })

    df_tmp = df_tmp.assign(**{
        f'rolling_range_{period}_hrs': df_tmp[f'rolling_max_{period}_hrs'] - df_tmp[f'rolling_min_{period}_hrs']
        for period in periods
    })

    df_tmp = df_tmp.sort_index()
    return df_tmp


def get_other_features(df_tmp, boundary_layer_mapper, metadata):
    D_COL = 'created_at'
    for attr in ['hour', 'day', 'dayofweek', 'month', 'is_month_start', 'is_month_end', 'year']:
        df_tmp[f'{D_COL}_{attr}'] = getattr(df_tmp[D_COL].dt, attr)
    df_tmp['week'] = df_tmp[D_COL].dt.isocalendar().week.astype(int)

    df_tmp['boundary_layer_height'] = df_tmp['created_at_hour'].map(boundary_layer_mapper)

    df_tmp['temp_device_number'] = df_tmp['device_number']
    df_tmp = pd.get_dummies(df_tmp, columns=['temp_device_number'])

    df_tmp = pd.merge(df_tmp, metadata, on='device_number', how='left')
    return df_tmp


def get_agg_channel_data_test(chan_num, test_forecast_data, freq='1H'):
    """
  Get Hourly Aggregates using Mean of the Data for testing.
  """

    chan = test_forecast_data[test_forecast_data['device_number'] == chan_num]
    chan = chan.sort_values(by='created_at')[['created_at', 'pm2_5']].set_index('created_at')
    chan = chan.interpolate('time', limit_direction='both')

    chan_agg = chan.resample(freq).mean().reset_index()
    chan_agg['device_number'] = chan_num

    return chan_agg


def save_next_24hrs_forecasts(data):
    db.hourly_forecasts.insert_many(data)


def make_test_forecast_data(forecast_data, test_lag_last_date_hour, test_end_datetime, all_channels):
    all_tdf = pd.DataFrame()
    for c in all_channels:
        tdf = pd.DataFrame()
        tdf['created_at'] = pd.date_range(start=test_lag_last_date_hour - pd.Timedelta(days=2), end=test_end_datetime,
                                          freq='1800S')
        tdf['device_number'] = c
        tdf['pm2_5'] = np.nan
        all_tdf = pd.concat([tdf, all_tdf], axis=0)

    test_forecast_data = forecast_data[
        (forecast_data['created_at'] >= test_lag_last_date_hour - pd.Timedelta(days=2)) & (
                forecast_data['created_at'] <= test_end_datetime)].drop('date', axis=1)
    test_forecast_data = pd.merge(all_tdf[['created_at', 'device_number']], test_forecast_data,
                                  on=['created_at', 'device_number'], how='outer')

    return test_forecast_data


def get_next_24hrs_forecasts():
    # load & preprocess test data:

    print(configuration.TEST_LAG_LAST_DATE_HOUR)
    print(configuration.TEST_DATE_HOUR_END)

    clf = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.AIRQO_PREDICT_BUCKET,
                                     'hourly_forecast_ model.pkl')
    all_channels = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID, configuration.AIRQO_PREDICT_BUCKET,
                                              'all_channels.pkl')

    forecast_data, metadata, boundary_layer_mapper = preprocess_forecast_data(configuration.METADATA_PATH,
                                                                              configuration.BOUNDARY_LAYER_PATH,
                                                                              date_to_str_2(
                                                                                  configuration.TEST_LAG_LAST_DATE_HOUR))

    test_forecast_data = make_test_forecast_data(forecast_data, configuration.TEST_LAG_LAST_DATE_HOUR,
                                                 configuration.TEST_DATE_HOUR_END, all_channels)

    op = Parallel(n_jobs=1)(
        delayed(get_agg_channel_data_test)(chan_num, test_forecast_data, freq='1H') for chan_num in all_channels)
    test = pd.concat(op, axis=0).reset_index(drop=True)[test_forecast_data.columns.tolist()]

    test = preprocess_df(test, boundary_layer_mapper, metadata, configuration.TARGET_COL, configuration.N_HRS_BACK,
                         configuration.SEQ_LEN, is_test=True)
    test = test[(test['created_at'] >= configuration.TEST_DATE_HOUR_START) & (
            test['created_at'] <= configuration.TEST_DATE_HOUR_END)]

    test_orig = test[["created_at", "pm2_5", "device_number"]].copy()

    features = [c for c in test.columns if c not in ["created_at", "pm2_5", "Unnamed: 0"]]
    test_preds = clf.predict(test[features])

    test_orig['preds'] = test_preds

    return test_orig, configuration.TEST_DATE_HOUR_START, configuration.TEST_DATE_HOUR_END


def get_forecasts_for_channel(next_24_hrs, chan_num):
    return next_24_hrs[next_24_hrs['device_number'] == chan_num]


if __name__ == '__main__':
    TARGET_COL = 'pm2_5'
    next_24hrs_forecasts, TEST_DATE_HOUR_START, TEST_DATE_HOUR_END = get_next_24hrs_forecasts()

    all_channels_x = get_trained_model_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID,
                                                configuration.AIRQO_PREDICT_BUCKET, 'all_channels.pkl')
    forecast_results = []

    created_at = str_to_date_2(date_to_str_2(datetime.now()))
    for channel_id in all_channels_x:
        result = get_forecasts_for_channel(next_24hrs_forecasts, channel_id)
        record = {'channel_id': int(channel_id),
                  'forecasts': result['preds'].tolist(),
                  'created_at': created_at,
                  'forecast_time': result['created_at'].tolist()}
        forecast_results.append(record)

    save_next_24hrs_forecasts(forecast_results)
