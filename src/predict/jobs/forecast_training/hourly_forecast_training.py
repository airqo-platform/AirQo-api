import warnings

import mlflow
import mlflow.sklearn
import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from lightgbm import LGBMRegressor, early_stopping
from sklearn.metrics import mean_squared_error

from config import configuration, environment
from transform import get_boundary_layer_data, get_forecast_data, get_metadata
from utils import upload_csv_file_to_gcs, upload_trained_model_to_gcs

warnings.filterwarnings("ignore")

mlflow.set_tracking_uri(configuration.MLFLOW_TRACKING_URI)
mlflow.set_experiment(experiment_name=f"hourly_forecast_{environment}")

print(f'mlflow server uri: {mlflow.get_tracking_uri()}')


def preprocess_forecast_data():
    forecast_data = get_forecast_data()
    metadata = process_metadata(get_metadata())
    boundary_layer = get_boundary_layer_data()
    boundary_layer_mapper = pd.Series(index=boundary_layer['hour'], data=boundary_layer['height'])

    forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'], format='%Y-%m-%d %H:%M:%S')
    forecast_data['date'] = forecast_data['created_at'].dt.date
    forecast_data = forecast_data[forecast_data['device_number'].isin(metadata['device_number'])].reset_index(drop=True)

    # upload metadata and boundray layer to gcs
    metadata.to_csv('meta.csv')
    boundary_layer_mapper.to_csv('boundary_layer.csv')

    # upload  metadata
    upload_csv_file_to_gcs(
        configuration.GOOGLE_CLOUD_PROJECT_ID,
        configuration.CREDENTIALS,
        configuration.AIRQO_PREDICT_BUCKET,
        "meta.csv", "meta.csv")

    # upload boundary layer data
    upload_csv_file_to_gcs(
        configuration.GOOGLE_CLOUD_PROJECT_ID,
        configuration.CREDENTIALS,
        configuration.AIRQO_PREDICT_BUCKET,
        "boundary_layer.csv", "boundary_layer.csv")

    return forecast_data, metadata, boundary_layer_mapper


def process_metadata(metadata):
    fts = [c for c in metadata if c not in ['device_number']]
    cat_fts = metadata[fts].select_dtypes('object').columns.tolist()
    metadata[cat_fts] = metadata[cat_fts].apply(lambda x: pd.factorize(x)[0])

    # this features can be fully eliminated during the refractoring process
    drop_fts = ['device', 'location_activities', 'site_name', 'road_intensity',
                'land_use', 'traffic_factor', 'road_status', 'region']
    result = metadata.drop(drop_fts, axis=1)
    return result


def initialise_training_constants():
    # Boolean value to indicate whether to train or only predict
    TRAIN_MODEL_NOW = True
    TARGET_COL = 'pm2_5'

    N_HRS_BACK = 24
    SEQ_LEN = 24

    forecast_data, metadata, boundary_layer_mapper = preprocess_forecast_data()

    if TRAIN_MODEL_NOW:
        print(forecast_data.columns)
        train_forecast_data = forecast_data.drop('date', axis=1)
        train = make_train(train_forecast_data)
        train['pm2_5'] = np.clip(train['pm2_5'], 0, 350)

        train = preprocess_df(train, boundary_layer_mapper, metadata, TARGET_COL, N_HRS_BACK, SEQ_LEN, is_test=False)
        clf = train_model(train)

        # load new model
        upload_trained_model_to_gcs(
            clf,
            configuration.GOOGLE_CLOUD_PROJECT_ID,
            configuration.AIRQO_PREDICT_BUCKET,
            'model.pkl')

        print(clf)


def train_model(train):
    """
  Perform the actual training
  """
    features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
    TARGET_COL = "pm2_5"

    trn = train.groupby('device_number').apply(lambda x: x[:-24 * 7]).reset_index(drop=True)
    val = train.groupby('device_number').apply(lambda x: x[-24 * 7:]).reset_index(drop=True)
    # change devie number to int
    trn['device_number'] = trn['device_number'].astype(int)
    val['device_number'] = val['device_number'].astype(int)
    y_trn, y_val = trn[TARGET_COL], val[TARGET_COL]

    # start training the model
    with mlflow.start_run():
        print("Model training started.....")
        n_estimators = 5000
        learning_rate = 0.05
        colsample_bytree = 0.4
        reg_alpha = 0
        reg_lambda = 1
        max_depth = -1
        random_state = 1

        clf = LGBMRegressor(
            n_estimators=n_estimators,
            learning_rate=learning_rate,
            colsample_bytree=colsample_bytree,
            reg_alpha=reg_alpha,
            reg_lambda=reg_lambda,
            max_depth=max_depth,
            random_state=random_state)

        clf.fit(trn[features], y_trn, eval_set=[(val[features], y_val)], verbose=50,
                callbacks=[early_stopping(stopping_rounds=150)], eval_metric='rmse')
        print("Model training completed.....")

        # Log parameters
        mlflow.log_param("n_estimators", n_estimators)
        mlflow.log_param("learning_rate", learning_rate)
        mlflow.log_param("colsample_bytree", colsample_bytree)
        mlflow.log_param("reg_alpha", reg_alpha)
        mlflow.log_param("reg_lamba", reg_lambda)
        mlflow.log_param("max_depth", max_depth)
        mlflow.log_param("random_state", random_state)

        # Log model
        mlflow.sklearn.log_model(
            sk_model=clf,
            artifact_path="hourly_forecast_model",
            registered_model_name=f"lgbr_hourly_forecast_model_{environment}"
        )

        # model validation
        print("Being model validation.....")

        val_preds = clf.predict(val[features])
        rmse_val = mean_squared_error(val[TARGET_COL], val_preds) ** 0.5

        print("Model validation completed.....")
        print(f'Validation RMSE is {rmse_val}')

        # Log metrics
        mlflow.log_metric("VAL_RMSE", rmse_val)

        best_iter = clf.best_iteration_
        clf = LGBMRegressor(n_estimators=best_iter, learning_rate=0.05, colsample_bytree=0.4, reg_alpha=2, reg_lambda=1,
                            max_depth=-1, random_state=1)
        # change devie number to int
        train['device_number'] = train['device_number'].astype(int)
        clf.fit(train[features], train[TARGET_COL])

    return clf


def make_train(train_forecast_data):
    # Aggregate data every 1 hour using mean
    all_channels = train_forecast_data['device_number'].unique()
    # update model
    upload_trained_model_to_gcs(
        all_channels,
        configuration.GOOGLE_CLOUD_PROJECT_ID,
        configuration.AIRQO_PREDICT_BUCKET,
        'all_channels.pkl')

    op = Parallel(n_jobs=-1)(
        delayed(get_agg_channel_data_train)(chan_num, train_forecast_data, freq='1H') for chan_num in all_channels)
    train = pd.concat(op, axis=0).reset_index(drop=True)[train_forecast_data.columns.tolist()]
    train = train.groupby('device_number').apply(
        lambda x: x.set_index('created_at')['pm2_5'].interpolate('time', limit_direction='both')).reset_index()

    return train


def get_agg_channel_data_train(chan_num, train_forecast_data, freq='1H'):
    """
  Get Hourly Aggregates using Mean of the Data for training.
  """

    chan = train_forecast_data[train_forecast_data['device_number'] == chan_num]
    chan = chan.sort_values(by='created_at')[['created_at', 'pm2_5']].set_index('created_at')
    chan = chan.interpolate('time', limit_direction='both')

    chan_agg = chan.resample(freq).mean().reset_index()
    chan_agg['device_number'] = chan_num

    return chan_agg


def get_lag_features(df_tmp, TARGET_COL, N_HRS_BACK, SEQ_LEN):
    df_tmp = df_tmp.sort_values(by='created_at')

    # Shift Features
    df_tmp = df_tmp.assign(**{
        f'{TARGET_COL} (t-{t})': df_tmp.groupby('device_number')[TARGET_COL].shift(t)
        for t in range(N_HRS_BACK + SEQ_LEN - 1, N_HRS_BACK - 1, -1)
    })

    FIRST_SHIFT_COL = f'{TARGET_COL} (t-{N_HRS_BACK})'

    # Rolling Features
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
    # print(boundary_layer_mapper.head())
    D_COL = 'created_at'
    for attr in ['hour', 'day', 'dayofweek', 'month', 'is_month_start', 'is_month_end', 'week', 'year']:
        df_tmp[f'{D_COL}_{attr}'] = getattr(df_tmp[D_COL].dt, attr)

    df_tmp['boundary_layer_height'] = df_tmp['created_at_hour'].map(boundary_layer_mapper)

    df_tmp['temp_device_number'] = df_tmp['device_number']
    df_tmp = pd.get_dummies(df_tmp, columns=['temp_device_number'])

    df_tmp = pd.merge(df_tmp, metadata, on='device_number', how='left')
    return df_tmp


def preprocess_df(df_tmp, boundary_layer_mapper, metadata, target_column, n_hrs_back, seq_len, is_test=False):
    df_tmp = get_lag_features(df_tmp, target_column, n_hrs_back, seq_len)
    df_tmp = get_other_features(df_tmp, boundary_layer_mapper, metadata)

    return df_tmp


if __name__ == '__main__':
    initialise_training_constants()
