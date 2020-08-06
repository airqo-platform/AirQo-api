from google.cloud import storage
from google.cloud import bigquery
import numpy as np
import pandas as pd
import gcsfs
import numpy as np
import pandas as pd

from lightgbm import LGBMRegressor
from sklearn.metrics import mean_squared_error

import os
import joblib
from joblib import Parallel, delayed

import datetime as dt
from datetime import datetime,timedelta



def query_prediction_data():
    client = bigquery.Client()
    sql = """SELECT created_at ,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.clean_feeds_pms` """

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql,job_config=job_config).to_dataframe()
    df['created_at'] =  pd.to_datetime(df['created_at'],format='%Y-%m-%d %H:%M:%S')
    #df['created_at'] = df['created_at'].dt.tz_localize('Africa/Kampala')
    #time_indexed_data = df.set_index('created_at')
    return df 

def get_all_static_channels():
    client = bigquery.Client()

    query = """
        SELECT channel_id, latitude, longitude
        FROM `airqo-250220.thingspeak.channel`
        WHERE latitude != 0.0 OR longitude != 0.0
    """
    
    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config)

    results = query_job.result()
    static_channels = []

    if results.total_rows >=1:
        for row in results:
            static_channels.append(row.channel_id)
    return static_channels

def preprocess_forecast_data(forecast_data_path,metadata_path, boundary_layer_path):
  print('begin getting data from bq')
  #forecast_data = query_prediction_data() 
  forecast_data = pd.read_csv(forecast_data_path, usecols = ['created_at','channel_id', 'pm2_5'])
  print('end getting data from bq') 
  
  #getting metadata 
  metadata = preprocess_metadata(metadata_path)
  #getting boundarylayer data
  boundary_layer_mapper = get_boundary_layer_mapper(boundary_layer_path)

  #forecast_data['created_at'] = forecast_data['created_at'].apply(lambda x: x.replace(r'+03:00', ''))
  forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'], format='%Y-%m-%d %H:%M:%S')
  forecast_data['date'] = forecast_data['created_at'].dt.date
  forecast_data = forecast_data[forecast_data['channel_id'].isin(metadata['channel_id'])].reset_index(drop=True)
  channel_max_dates = forecast_data.groupby('channel_id').apply(lambda x: x['created_at'].max())

  ### Set this as a list of chanels to be used. Can be read from a file.
  #use_channels = channel_max_dates[channel_max_dates > pd.to_datetime('2020-07-12')].index.tolist()
  use_channels =  get_all_static_channels()
  
  forecast_data = forecast_data[forecast_data['channel_id'].isin(use_channels)]

  return forecast_data, metadata,boundary_layer_mapper


def preprocess_metadata(METADATA_PATH):
  metadata = pd.read_csv(METADATA_PATH)
  fts = [c for c in metadata if c not in ['chan_id']]
  cat_fts = metadata[fts].select_dtypes('object').columns.tolist()
  metadata[cat_fts] = metadata[cat_fts].apply(lambda x: pd.factorize(x)[0])
  metadata = metadata.rename({'chan_id': 'channel_id'}, axis=1)
  drop_fts = ['loc_ref', 'chan_ref', 'loc_mob_stat', 'airqo_name', 'district_lookup', 'county_lookup', 'coords', 'loc_start_date', 'loc_end_date', 'gmaps_link',
              'OSM_link', 'nearby_sources', 'geometry', 'geometry_43', 'event_logging_link']
  metadata = metadata.drop(drop_fts, axis=1)
  #metadata.to_csv('metadata_to_use.csv', index = False)

  return metadata


def get_boundary_layer_mapper(BOUNDARY_LAYER_PATH):  
  boundary_layer = pd.read_csv(BOUNDARY_LAYER_PATH)
  boundary_layer_mapper = pd.Series(index = boundary_layer['hour'], data = boundary_layer['height'])  
  
  return boundary_layer_mapper


def get_agg_channel_data_train(chan_num,train_forecast_data, freq='1H'):
  '''
  Get Hourly Aggregates using Mean of the Data for training.
  '''

  chan = train_forecast_data[train_forecast_data['channel_id'] == chan_num]
  chan = chan.sort_values(by = 'created_at')[['created_at', 'pm2_5']].set_index('created_at')
  chan = chan.interpolate('time', limit_direction='both')

  chan_agg = chan.resample(freq).mean().reset_index()
  chan_agg['channel_id'] = chan_num

  return chan_agg

def get_agg_channel_data_test(chan_num,test_forecast_data,freq='1H'):
  '''
  Get Hourly Aggregates using Mean of the Data for testing.
  '''

  chan = test_forecast_data[test_forecast_data['channel_id'] == chan_num]
  chan = chan.sort_values(by = 'created_at')[['created_at', 'pm2_5']].set_index('created_at')
  chan = chan.interpolate('time', limit_direction='both')

  chan_agg = chan.resample(freq).mean().reset_index()
  chan_agg['channel_id'] = chan_num

  return chan_agg


def make_train():

  ### Aggregate data every 1 hour using mean
  all_channels = train_forecast_data['channel_id'].unique()
  #joblib.dump(all_channels, 'all_channels.pkl')

  op = Parallel(n_jobs = -1)(delayed(get_agg_channel_data_train)(chan_num,train_forecast_data, freq='1H') for chan_num in all_channels)
  train = pd.concat(op, axis=0).reset_index(drop=True)[train_forecast_data.columns.tolist()]
  train = train.groupby('channel_id').apply(lambda x: x.set_index('created_at')['pm2_5'].interpolate('time', limit_direction = 'both')).reset_index()

  return train


def get_lag_features(df_tmp,TARGET_COL,N_HRS_BACK, SEQ_LEN):

  df_tmp = df_tmp.sort_values(by='created_at')
  
  ### Shift Features
  df_tmp = df_tmp.assign(**{
      f'{TARGET_COL} (t-{t})': df_tmp.groupby('channel_id')[TARGET_COL].shift(t)
      for t in range(N_HRS_BACK + SEQ_LEN -1, N_HRS_BACK - 1, -1)
  })

  FIRST_SHIFT_COL = f'{TARGET_COL} (t-{N_HRS_BACK})'
  
  ### Rolling Features
  periods  = [4, 12, 24, 48, 24 * 7, 24 * 14, 24 * 31]

  for agg_func in ['min', 'max', 'mean', 'std']:
     df_tmp = df_tmp.assign(**{
      f'rolling_{agg_func}_{period}_hrs': df_tmp.groupby('channel_id')[FIRST_SHIFT_COL].transform(lambda x: x.rolling(period, min_periods=1).agg(agg_func))
      for period in periods
    })

  df_tmp = df_tmp.assign(**{
      f'rolling_range_{period}_hrs': df_tmp[f'rolling_max_{period}_hrs'] - df_tmp[f'rolling_min_{period}_hrs']
      for period in periods
  })

  df_tmp = df_tmp.sort_index()

  return df_tmp

def get_other_features(df_tmp,boundary_layer_mapper,metadata):
  
  D_COL = 'created_at'
  for attr in ['hour', 'day', 'dayofweek', 'month', 'is_month_start', 'is_month_end', 'week', 'year']:
      df_tmp[f'{D_COL}_{attr}'] = getattr(df_tmp[D_COL].dt, attr)

  df_tmp['boundary_layer_height'] = df_tmp['created_at_hour'].map(boundary_layer_mapper)
  df_tmp['chan_id'] = df_tmp['channel_id']
  df_tmp = pd.get_dummies(df_tmp, columns=['chan_id'])
  df_tmp = pd.merge(df_tmp, metadata, on = 'channel_id', how = 'left')
  return df_tmp

def preprocess_df(df_tmp, boundary_layer_mapper, metadata, target_column,n_hrs_back, seq_len, is_test = False):

  df_tmp = get_lag_features(df_tmp,target_column, n_hrs_back, seq_len)
  df_tmp = get_other_features(df_tmp,boundary_layer_mapper,metadata)

  return df_tmp


def train_model(train):

  features = [c for c in train.columns if c not in ["created_at",  "pm2_5", "channel_id"]]
  TARGET_COL = "pm2_5"

  trn = train.groupby('channel_id').apply(lambda x: x[:-24*7]).reset_index(drop=True)
  val = train.groupby('channel_id').apply(lambda x: x[-24*7:]).reset_index(drop=True)
  y_trn, y_val  = trn[TARGET_COL], val[TARGET_COL]

  clf = LGBMRegressor(n_estimators=5000, learning_rate=0.05, colsample_bytree=0.4, reg_alpha=0, reg_lambda=1, max_depth=-1, random_state=1)
  clf.fit(trn[features], y_trn, eval_set = [(val[features], y_val)], verbose=50, early_stopping_rounds=150, eval_metric='rmse')

  val_preds = clf.predict(val[features])
  rmse_val = mean_squared_error(val[TARGET_COL], val_preds) ** 0.5
  print(f'Validation RMSE is {rmse_val}')

  best_iter = clf.best_iteration_
  clf = LGBMRegressor(n_estimators=best_iter, learning_rate=0.05, colsample_bytree=0.4, reg_alpha=2, reg_lambda=1, max_depth=-1, random_state=1)
  clf.fit(train[features], train[TARGET_COL])

  return clf


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date,'%Y-%m-%d %H:00:00')

def initialise_training_constants():
### These constants must be set before running
### Prediction will start from this date-hour
    test_start_datetime = date_to_str(datetime.now())
    test_end_datetime = date_to_str(datetime.now() + timedelta(hours=24))

    TEST_DATE_HOUR_START = pd.to_datetime(test_start_datetime)

    ### Prediction will end at this date-hour
    TEST_DATE_HOUR_END = pd.to_datetime(test_end_datetime)

    ### Training will start at this date-hour
    TRAIN_DATE_HOUR_START = pd.to_datetime('2019-06-01 00:00:00')

    ### Training will end at this date-hour
    TRAIN_DATE_HOUR_END = pd.to_datetime(date_to_str(datetime.now()))

    ### Boolean value to indicate whether to train or only predict
    TRAIN_MODEL_NOW = True
    TARGET_COL = 'pm2_5'

    ########### PATHS #############

    ### These paths must be set
    FORECAST_DATA_PATH = 'Zindi_PM2_5_forecast_data.csv'
    METADATA_PATH = 'meta.csv'
    BOUNDARY_LAYER_PATH = 'boundary_layer.csv'

    N_HRS_BACK = 24 
    SEQ_LEN = 24
    ROLLING_SEQ_LEN = 24*90
    MAX_LAGS = N_HRS_BACK + max(ROLLING_SEQ_LEN, SEQ_LEN) + 48 # Extra 48 or 2 days for safety
    TEST_LAG_LAST_DATE_HOUR = TEST_DATE_HOUR_START - pd.Timedelta(hours = MAX_LAGS)

    metadata = preprocess_metadata(METADATA_PATH)

    forecast_data, metadata, boundary_layer_mapper = preprocess_forecast_data(FORECAST_DATA_PATH,METADATA_PATH,BOUNDARY_LAYER_PATH)

    boundary_layer_mapper = get_boundary_layer_mapper(BOUNDARY_LAYER_PATH)

    if TRAIN_MODEL_NOW == True:
        train_forecast_data = forecast_data[(forecast_data['created_at'] >= TRAIN_DATE_HOUR_START) & (forecast_data['created_at'] <= TRAIN_DATE_HOUR_END)].drop('date', axis=1)
        train = make_train()
        train = preprocess_df(train, boundary_layer_mapper, metadata, TARGET_COL, N_HRS_BACK, SEQ_LEN, is_test = False)
        clf = train_model(train)

        ##dump the model to google cloud storage.
        #joblib.dump(clf, 'model.pkl')
        upload_trained_model_to_gcs('airqo-250220','airqo_prediction_bucket', 'model.pkl')


def get_next_24hrs_predictions():
    #load & preprocess test data:
    METADATA_PATH = 'meta.csv'
    BOUNDARY_LAYER_PATH = 'boundary_layer.csv'
    FORECAST_DATA_PATH = 'Zindi_PM2_5_forecast_data_.csv'
    
    #boundary_layer_mapper = get_boundary_layer_mapper(BOUNDARY_LAYER_PATH)
    forecast_data, metadata, boundary_layer_mapper = preprocess_forecast_data(FORECAST_DATA_PATH,METADATA_PATH,BOUNDARY_LAYER_PATH)
    #set constants
    test_start_datetime = date_to_str(datetime.now())
    test_end_datetime = date_to_str(datetime.now() + timedelta(hours=24))

    TEST_DATE_HOUR_START = pd.to_datetime('2020-07-13 09:00:00')

    ### Prediction will end at this date-hour
    TEST_DATE_HOUR_END = pd.to_datetime('2020-07-14 08:00:00')
    N_HRS_BACK = 24 
    SEQ_LEN = 24
    ROLLING_SEQ_LEN = 24*90
    MAX_LAGS = N_HRS_BACK + max(ROLLING_SEQ_LEN, SEQ_LEN) + 48 # Extra 48 or 2 days for safety
    TEST_LAG_LAST_DATE_HOUR = TEST_DATE_HOUR_START - pd.Timedelta(hours = MAX_LAGS)
    TARGET_COL = 'pm2_5'
    
    CHANNELS_TO_PREDICT_PATH = 'all_channels.pkl' 
    clf = get_trained_model_from_gcs('airqo-250220','airqo_prediction_bucket', 'model.pkl')
    #TRAIN_MODEL_PATH = 'model.pkl'
    #clf = joblib.load(TRAIN_MODEL_PATH)
   
    test_forecast_data = forecast_data[(forecast_data['created_at'] >= TEST_LAG_LAST_DATE_HOUR) & (forecast_data['created_at'] <= TEST_DATE_HOUR_END + pd.Timedelta(days=2))].drop('date', axis=1)
    #TODO:get the channelIds to use for prediction
    all_channels = joblib.load('all_channels.pkl')

    op = Parallel(n_jobs = 1)(delayed(get_agg_channel_data_test)(chan_num, test_forecast_data, freq='1H') for chan_num in all_channels)
    test = pd.concat(op, axis=0).reset_index(drop=True)[test_forecast_data.columns.tolist()]
    
    test = test.groupby('channel_id').apply(lambda x: x.set_index('created_at')['pm2_5'].interpolate('time', limit_direction = 'both')).reset_index()

    test = preprocess_df(test, boundary_layer_mapper, metadata, TARGET_COL, N_HRS_BACK, SEQ_LEN, is_test = True)
    test = test[(test['created_at'] >= TEST_DATE_HOUR_START) & (test['created_at'] <= TEST_DATE_HOUR_END) ]

    test_orig = test[["created_at",  "pm2_5", "channel_id"]].copy()

    #modified train.columns and added test.columns
    features = [c for c in test.columns if c not in ["created_at",  "pm2_5", "channel_id"]]
    test_preds = clf.predict(test[features])
    
    test_orig['preds'] = test_preds

    return test_orig

def get_predictions_for_channel(next_24_hrs, chan_num):
  return next_24_hrs[next_24_hrs['channel_id'] == chan_num]

def invoke_training_process():
    metadata = preprocess_metadata(METADATA_PATH)


def list_buckets():
    """Lists all buckets."""

    storage_client = storage.Client()
    buckets = storage_client.list_buckets()

    for bucket in buckets:
        print(bucket.name)

def upload_blob(bucket_name, source_file_name, destination_blob_name):
    """Uploads a file to the bucket."""
    # bucket_name = "your-bucket-name"
    # source_file_name = "local/path/to/file"
    # destination_blob_name = "storage-object-name"

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)

    blob.upload_from_filename(source_file_name)

    print(
        "File {} uploaded to {}.".format(
            source_file_name, destination_blob_name
        )
    )

def download_blob(bucket_name,source_blob_name, destination_file_name):
    storage_client = storage.Client()
   
    bucket = storage_client.get_bucket(bucket_name)
    #select bucket file
    blob = bucket.blob(source_blob_name)
    #download that file and name it 'local.joblib'
    filepath = os.getcwd()
    destination_file_path = os.path.join(filepath, destination_file_name)
    blob.download_to_filename(destination_file_path)
    #load that file from local file
    job=joblib.load(destination_file_name)

def get_trained_model_from_gcs(project_name,bucket_name,source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    fs.ls(bucket_name)
    with fs.open(bucket_name + '/' + source_blob_name, 'rb') as handle:
        job = joblib.load(handle)

def upload_trained_model_to_gcs(project_name,bucket_name,source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)    
    with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
        job = joblib.dump(handle)


if __name__ == '__main__':
    #get_trained_model_from_gcs('airqo-250220','airqo_prediction_bucket', 'model.pkl')
    #list_buckets()
    #upload_blob('airqo_prediction_bucket', 'E:\Work\AirQo\AirQo-api\src\predict\jobs\model.pkl', 'model.pkl')
    #download_blob('airqo_prediction_bucket','model.pkl','model_downloaded2.pkl')
    initialise_training_constants()
    
    
    
    
