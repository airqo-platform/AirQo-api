import numpy as np
import pandas as pd
from google.oauth2 import service_account
from config import configuration, environment
from keras.models import Sequential
from keras.layers import LSTM, Dense
from keras.callbacks import EarlyStopping, ModelCheckpoint
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import TimeSeriesSplit

from sklearn.utils import class_weight
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
  SELECT DISTINCT timestamp, device_number, s1_pm2_5 FROM {configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH) and tenant = 'airqo'
    ORDER
    BY
    timestamp
    """
    df = pd.read_gbq(query, project_id=configuration.GOOGLE_CLOUD_PROJECT_ID, credentials=credentials)
    df.rename(columns={'s1_pm2_5': 'pm2_5'}, inplace=True)
    print('Data fetched from bigquery')
    return df


def sort_and_clean_data(df):
    """ sorts the data by device_number and hour and removes rows with null values. """
    print('sorting and cleaning data')
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['device_number'] = df['device_number'].astype(str)
    df = df.groupby('device_number').resample('1H', on='timestamp').mean()
    df = df.drop('device_number', axis=1)  # this line drops the column
    df = df.reset_index()
    # interpolate missing values
    df['pm2_5'] = df['pm2_5'].interpolate(method='linear', limit_direction='forward', axis=0)
    return df


# Option 1: convert the string to an integer using pd.Timedelta
def add_fault_columns(df, stuckat_threshold, highvar_threshold):
    """

    adds stuck-at and high-variance fault columns to the dataframe.

    """
    final_df = pd.DataFrame()
    for device in df["device_number"].unique():
        df1 = df[df["device_number"] == device]
        df1['pm2_5'] = df1.pm2_5.astype(float)
        df1 = df1.set_index('timestamp').sort_index()
        df1['rolling_mean_hr'] = df1['pm2_5'].rolling(1).mean()
        df1['rolling_mean_hr_diff'] = df1['rolling_mean_hr'].diff()

        df1['stuck_at_fault'] = df1['rolling_mean_hr_diff'].apply(
            lambda x: 1 if abs(x) <= stuckat_threshold else 0)

        df1['col_diff'] = (df1.pm2_5.values -
                           df1.rolling_mean_hr.values)
        df1['high_var_fault'] = df1['col_diff'].apply(
            lambda x: 1 if abs(x) <= highvar_threshold else 0)
        df1.reset_index(inplace=True)
        final_df = pd.concat([final_df, df1], ignore_index=True)

    return final_df


def scale_and_reshape_data_for_lstm(dataframe):
    print('Scaling and reshaping data for LSTM')
    features = dataframe[['timestamp', 'device_number', 'pm2_5']].values
    labels = dataframe[['stuck_at_fault', 'high_var_fault']].values

    scaler = MinMaxScaler()
    try:
        features = scaler.fit_transform(features)
    except ValueError as e:
        print("Error while scaling the features:", e)
        return None, None, None

    timesteps = 24
    try:
        # group the features by device_number
        grouped_features = []
        for device_number, group in dataframe.groupby('device_number'):
            group_features = group[['timestamp', 'device_number', 'pm2_5']].values
            group_features = group_features.reshape((group_features.shape[0], timesteps, group_features.shape[1]))

            grouped_features.append(group_features)
        features = np.concatenate(grouped_features, axis=0)
    except ValueError as e:
        print("Error while reshaping the features:", e)
        return None, None, None

    return features, labels, scaler


def train_lstm_model(features, labels):
    with mlflow.start_run():

        test_size = 0.2
        # use TimeSeriesSplit to split the data into train and validation sets
        splitter = TimeSeriesSplit(n_splits=5)
        for train_index, val_index in splitter.split(features):
            features_train, features_val = features[train_index], features[val_index]
            labels_train, labels_val = labels[train_index], labels[val_index]

        num_units = 50
        model = Sequential()
        model.add(LSTM(num_units, input_shape=(features.shape[1], features.shape[2])))
        model.add(Dense(4, activation='sigmoid'))
        model.compile(optimizer="adam", loss='binary_crossentropy', metrics="accuracy")
        num_epochs = 10
        batch_size = 128
        class_weights = class_weight.compute_class_weight('balanced', classes=np.unique(labels_train), y=labels_train)

        # define callbacks for early stopping and model checkpointing
        early_stopping = EarlyStopping(monitor='val_loss', patience=3, mode='min')
        model_checkpoint = ModelCheckpoint('best_model.h5', monitor='val_loss', save_best_only=True, mode='min')

        try:
            model.fit(features_train,
                      labels_train,
                      epochs=num_epochs,
                      verbose=1,
                      batch_size=batch_size,
                      validation_data=(features_val, labels_val),
                      class_weight=class_weights,
                      callbacks=[early_stopping, model_checkpoint])
        except ValueError as e:
            print("Error while training the model:", e)
            return None

        mlflow.log_param("test_size", test_size)
        mlflow.log_param("num_epochs", num_epochs)
        mlflow.log_param("batch_size", batch_size)
        mlflow.log_param("num_units", num_units)

        # log the model as an artifact in MLFlow
        mlflow.keras.log_model(model, "model")

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
    df = fetch_bigquery_data()
    df = sort_and_clean_data(df)
    df = add_fault_columns(df, stuckat_threshold=1, highvar_threshold=50)
    X, y, scaler = scale_and_reshape_data_for_lstm(df)
    model = train_lstm_model(X, y)

    upload_trained_model_to_gcs(model, scaler, {configuration.GOOGLE_CLOUD_PROJECT_ID},
                                {configuration.AIRQO_FAULT_DETECTION_BUCKET}, "fault-detection-model")
