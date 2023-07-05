import pandas as pd
import joblib
from google.oauth2 import service_account
from config import configuration
import gcsfs
import numpy as np

def fetch_bigquery_data():
    """gets data from the bigquery table"""
    # print('fetching data from bigquery')
    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    query = f"""
    SELECT DISTINCT timestamp, device_number, s1_pm2_5, s2_pm2_5 FROM {configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) and tenant = 'airqo'
      ORDER
      BY
      timestamp
      """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['device_number'] = df['device_number'].astype(str)
    df = df.groupby(['device_number', pd.Grouper(key='timestamp', freq='H')]).mean(numeric_only=True)
    df = df.reset_index()
    df.sort_values(by=['device_number', 'timestamp'], inplace=True)
    df['device_number'] = df['device_number'].astype(int)
    print('data fetched from bigquery')
    return df


def scale_data(df, scaler):
    """
    scales data using MinMaxScaler
    """
    inputs = df.iloc[:, : 3].values
    additional_features = df.iloc[:, 3:].values.astype('float32')

    scaled_inputs = scaler.transform(inputs)
    scaled_inputs = np.concatenate((scaled_inputs, additional_features), axis=1)

    print("Data scaled")

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
    with fs.open(bucket_name + '/' + source_blob_name, 'rb') as model_handle:
        model = joblib.load(model_handle)

        print("Model loaded from GCS bucket")

        # load the scaler from GCS bucket
    with fs.open(bucket_name + '/' + scaler_blob_name, 'rb') as scaler_handle:
        scaler = joblib.load(scaler_handle)

        print("Scaler loaded from GCS bucket")

    return model, scaler


# def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
#     fs = gcsfs.GCSFileSystem(project=project_name)
#     fs.ls(bucket_name)
#     with fs.open(bucket_name + '/' + source_blob_name, 'rb') as handle:
#         job = joblib.load(handle)
#     return job

def create_dataset(X, time_steps=1):
    Xs = []
    for i in range(len(X) - time_steps):
        v = X[i:(i + time_steps), :]
        Xs.append(v)
    print("Dataset created")
    return np.array(Xs)

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
                                                           configuration.BUCKET_NAME, 'lstm_model.h5', 'scaler.pkl')
    scaled_data = scale_data(new_data, scaler)
    X_new = create_dataset(scaled_data, 7)
    y_pred = model.predict(X_new)
    y_pred = np.round(y_pred)
    pred_df = pd.DataFrame(y_pred,
                           columns=['offset_fault', 'out_of_bounds_fault', 'data_loss_fault', 'high_variance_fault'])

    pred_df['device_number'] = original_data['device_number'].iloc[7:].values

    final_df = pd.merge(original_data, pred_df, on='device_number')

    # return rows where atleast one fault is detected(1)
    final_df = final_df[(final_df.iloc[:, 3:] == 1).any(axis=1)]
    #save df to mongodb

    print(final_df.head())
