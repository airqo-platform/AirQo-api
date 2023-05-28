import numpy as np
import pandas as pd
from google.oauth2 import service_account
from config import configuration, environment
from keras.models import Sequential
from keras.layers import LSTM, Dense
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
import gcsfs
from datetime import datetime
import joblib
import mlflow
import warnings

warnings.filterwarnings("ignore")

mlflow.set_tracking_uri(configuration.MLFLOW_TRACKING_URI)
mlflow.set_experiment(experiment_name=f"fault_detection_{environment}")

print(f'mlflow server uri: {mlflow.get_tracking_uri()}')


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    print('fetching data from bigquery')
    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    query = f"""
  SELECT DISTINCT timestamp, device_number, s1_pm2_5, s2_pm2_5 FROM {configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH) and tenant = 'airqo'
    ORDER
    BY
    timestamp
    """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    print('Data fetched from bigquery')
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(by=['device_number', 'timestamp'])
    df.reset_index(inplace=True)
    df.to_csv('data.csv', index=False)
    return df


def add_fault_columns(df, offset_threshold, min_value, max_value, highvar_threshold):
    """

    adds offset, out of bounds, data loss and high variance fault columns to the dataframe.

    """
    final_df = pd.DataFrame()
    for device in df["device_number"].unique():
        df1 = df[df["device_number"] == device]
        df1['s1_pm2_5'] = df1.s1_pm2_5.astype(float)
        df1['s2_pm2_5'] = df1.s2_pm2_5.astype(float)
        df1 = df1.set_index('timestamp').sort_index()

        df1['offset_fault'] = (df1['s1_pm2_5'] - df1['s2_pm2_5']).abs().apply(
            lambda x: 1 if x >= offset_threshold else 0)
        df1['out_of_bounds_fault'] = ((df1['s1_pm2_5'] < min_value) | (df1['s1_pm2_5'] > max_value) |
                                      (df1['s2_pm2_5'] < min_value) | (df1['s2_pm2_5'] > max_value)).astype(int)
        df1['data_loss_fault'] = (df1['s1_pm2_5'].isnull() | df1['s2_pm2_5'].isnull()).astype(int)

        df1['high_var_fault'] = (df1['s1_pm2_5'].rolling(10).std() > highvar_threshold) | (
                df1['s2_pm2_5'].rolling(10).std() > highvar_threshold).astype(int)

        df1.reset_index(inplace=True)
        final_df = pd.concat([final_df, df1], ignore_index=True)

        return final_df


def get_other_features(df):
    attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute', 'second']
    for a in attributes:
        df[a] = df['timestamp'].dt.__getattribute__(a)

    df['week'] = df['timestamp'].dt.isocalendar().week

    print("Adding other features")
    return df


def fit_scaler(df):
    scaler = MinMaxScaler()
    num_cols = ['pm2_5_1', 'pm2_5_2', 'year', 'month', 'day', 'hour', 'minute', 'second']

    # fit and transform the training data
    scaled_df = scaler.fit_transform(df[num_cols])

    return scaled_df


def reshape_data(data, timesteps):
    """
    reshapes data into a 3D array of shape (samples, timesteps, features)
    """
    reshaped_data = []
    for i in range(len(data) - timesteps):
        window = data[i:(i + timesteps), :]
        reshaped_data.append(window)

    reshaped_data = np.array(reshaped_data)

    return reshaped_data


def create_model(timesteps, features):
    """
    creates an LSTM model with one LSTM layer and one dense layer
    """
    model = Sequential()
    model.add(LSTM(64, input_shape=(timesteps, features)))
    model.add(Dense(4, activation='sigmoid'))
    model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])

    return model


def train_model(data, timesteps, test_size):
    """
    trains an LSTM model on the data and logs the parameters and metrics with mlflow
    """
    X = np.array([x for x, y in data])
    y = np.array([y for x, y in data])
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size)
    features = X.shape[2]
    model = create_model(timesteps, features)
    model.fit(X_train, y_train, epochs=10, batch_size=32)
    test_loss, test_acc = model.evaluate(X_test, y_test)

    # log the parameters and metrics with mlflow
    mlflow.log_param('timesteps', timesteps)
    mlflow.log_param('features', features)
    mlflow.log_param('test_size', test_size)
    mlflow.log_metric('test_loss', test_loss)
    mlflow.log_metric('test_acc', test_acc)

    return model


def upload_trained_model_to_gcs(trained_model, scaler, project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)

    # backup previous model
    try:
        fs.rename(f'{bucket_name}/{source_blob_name}', f'{bucket_name}/{datetime.now()}-{source_blob_name}')
        print("Bucket: previous model is backed up")
    except:
        print("Bucket: No file to updated")

    # store new model and scaler
    with fs.open(bucket_name + '/' + source_blob_name + '.pkl', 'wb') as handle:
        joblib.dump((trained_model, scaler), handle)


if __name__ == '__main__':
    training_df = fetch_bigquery_data()
    training_df = add_fault_columns(training_df, 25, 0, 500, 50)
    training_df = get_other_features(training_df)
    training_df = fit_scaler(training_df)
    groups = training_df.groupby('device_number')
    timesteps = 336
    reshaped_data = []

    for device, group in groups:
        group = group.drop('device_number', axis=1)

        X = group.drop(['offset_fault', 'out_of_bounds_fault', 'data_loss_fault', 'high_var_fault'], axis=1).values
        y = group[['offset_fault', 'out_of_bounds_fault', 'data_loss_fault', 'high_var_fault']].values

        X_reshaped = reshape_data(X, timesteps)
        y_reshaped = reshape_data(y, timesteps)

        reshaped_data.extend((X_reshaped, y_reshaped))

    trained_model = train_model(reshaped_data, timesteps, 0.2)
    print(trained_model)
