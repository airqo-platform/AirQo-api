import pandas as pd
import os
import joblib
from google.oauth2 import service_account
from config import configuration
from utils import date_to_str
import gcsfs
import numpy as np
from tensorflow import keras
import datetime


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    credentials = service_account.Credentials.from_service_account_file(
        configuration.CREDENTIALS)



    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['device_number'] = df['device_number'].astype(str)
    df = df.groupby(['device_number', pd.Grouper(key='timestamp', freq='H')]).mean(numeric_only=True)
    df = df.reset_index()
    df.sort_values(by=['device_number', 'timestamp'], inplace=True)
    df['device_number'] = df['device_number'].astype(int)
    new_index = pd.date_range(start=df['timestamp'].min(), end=df['timestamp'].max(), freq='H')
    df = df.set_index(['device_number', 'timestamp']).reindex(
        pd.MultiIndex.from_product([df['device_number'].unique(), new_index], names=['device_number', 'timestamp']))
    df = df.interpolate(method='linear', limit_direction='both').reset_index()
    return df


def scale_data(df, scaler):
    """
    scales data using MinMaxScaler
    """

    additional_features = []

    inputs = df.iloc[:, : 3].values
    additional_features = df.iloc[:, 3:].values
    scaled_df = scaler.transform(inputs)

    scaled_inputs = np.concatenate((scaled_df, additional_features), axis=1)

    print('Data scaled')
    return scaled_inputs


def preprocess_data(df):
    df1 = get_other_features(df)
    return df1


def get_other_features(df):
    """
    adds datetime features such as hour, minute, second dato the dataframe
    """
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute', 'second']
    for a in attributes:
        df[a] = df['timestamp'].dt.__getattribute__(a)

    df['week'] = df['timestamp'].dt.isocalendar().week
    df.drop('timestamp', axis=1, inplace=True)
    print("TimeStamp features added")
    return df


def load_trained_model_and_scaler_from_gcs(project_name, bucket_name, source_blob_name, scaler_blob_name):
    # create a GCSFileSystem object
    fs = gcsfs.GCSFileSystem(project=project_name)

    # load the model from GCS bucket
    # Download the model file to a temporary local file
    temp_file = 'temp_model.keras'
    with fs.open(bucket_name + '/' + source_blob_name, 'rb') as model_handle:
        open(temp_file, 'wb').write(model_handle.read())

    model = keras.models.load_model(temp_file)

    os.remove(temp_file)

    print("Model loaded from GCS bucket")

    # load the scaler from GCS bucket
    with fs.open(bucket_name + '/' + scaler_blob_name, 'rb') as scaler_handle:
        scaler = joblib.load(scaler_handle)

        print("Scaler loaded from GCS bucket")

    return model, scaler


def create_3d_lstm_array(x):
    x_3d = []
    device_nums = np.unique(x[:, 0])
    for device_num in device_nums:
        mask = x[:, 0] == device_num
        features = x[mask, :]
        x_3d.append(features)
    x_3d = np.array(x_3d)
    return x_3d


def get_faulty_devices(df, fault_df):
    faulty_devices = []
    for device in df['device'].unique():
        device_df = df[df['device'] == device]
        if (fault_df[fault_df['device'] == device].iloc[:, 1:] == 1).any().any():
            faulty_devices.append(device_df)
    return pd.concat(faulty_devices)


if __name__ == '__main__':
    device_data = fetch_bigquery_data()
    original_data = device_data.copy()
    new_data = preprocess_data(original_data)
    model, scaler = load_trained_model_and_scaler_from_gcs(configuration.GOOGLE_CLOUD_PROJECT_ID,
                                                           configuration.BUCKET_NAME, 'lstm_model.keras', 'scaler.pkl')
    scaled_data = scale_data(new_data, scaler)
    X_new = create_3d_lstm_array(scaled_data)
    y_pred = model.predict_classes(X_new.astype('float32'))
    y_pred = np.round(y_pred)
    pred_df = pd.DataFrame(y_pred,
                           columns=['offset_fault', 'out_of_bounds_fault', 'high_variance_fault'])

    pred_df['device_number'] = original_data['device_number'].iloc[7:].values

    final_df = pd.merge(original_data, pred_df, on='device_number')

    # return rows where atleast one fault is detected(1)
    final_df = final_df[(final_df.iloc[:, 3:] == 1).any(axis=1)]
    # save df to mongodb

    print(final_df.head())
