import numpy as np
import pandas as pd
import os
from google.oauth2 import service_account
from config import configuration
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout
from datetime import datetime
import gcsfs
import joblib


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    # print('fetching data from bigquery')
    credentials = service_account.Credentials.from_service_account_file(configuration.CREDENTIALS)
    query = f"""
    SELECT DISTINCT timestamp, device_number, s1_pm2_5, s2_pm2_5 FROM {configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements where DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) and tenant = 'airqo'
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


def add_fault_columns(df, offset_threshold, min_value, max_value, highvar_threshold):
    """
    adds offset, out of bounds, data loss and high variance fault columns to the dataframe.
    """
    fault_df = pd.DataFrame()
    for device in df["device_number"].unique():
        df1 = df[df["device_number"] == device].copy()
        df1['s1_pm2_5'] = df1.s1_pm2_5.astype(float)
        df1['s2_pm2_5'] = df1.s2_pm2_5.astype(float)

        df1['offset_fault'] = (df1['s1_pm2_5'] - df1['s2_pm2_5']).abs().apply(
            lambda x: 1 if x >= offset_threshold else 0)
        df1['out_of_bounds_fault'] = ((df1['s1_pm2_5'] < min_value) | (df1['s1_pm2_5'] > max_value) |
                                      (df1['s2_pm2_5'] < min_value) | (df1['s2_pm2_5'] > max_value)) * 1
        df1['data_loss_fault'] = (df1['s1_pm2_5'].isnull() | df1['s2_pm2_5'].isnull()) * 1

        df1['high_var_fault'] = ((df1['s1_pm2_5'].rolling(10).std() > highvar_threshold) | (
                df1['s2_pm2_5'].rolling(10).std() > highvar_threshold)).astype(int)

        df1.reset_index(inplace=True)
        fault_df = pd.concat([fault_df, df1], ignore_index=True)

    print("Fault columns added")
    return fault_df


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


def scale_data(df):
    """
    scales data using MinMaxScaler
    """
    inputs = df.iloc[:, : 3].values
    additional_features = df.iloc[:, 3:-4].values
    targets = df.iloc[:, -4:].values
    input_scaler = MinMaxScaler()

    # fit the scalers on the training data
    input_scaler.fit(inputs)

    # transform the inputs and targets
    scaled_inputs = input_scaler.transform(inputs)
    scaled_inputs = np.concatenate((scaled_inputs, additional_features), axis=1)
    print("Data scaled")
    return scaled_inputs, targets, input_scaler


def create_dataset(X, y, time_steps=1):
    Xs, ys = [], []
    for i in range(len(X) - time_steps):
        v = X[i:(i + time_steps), :]
        Xs.append(v)
        ys.append(y[i + time_steps])
    print("Dataset created")
    return np.array(Xs), np.array(ys)


def split_data_by_date(df):
    """
    splits data by date for each device
    """
    train_data = pd.DataFrame()
    test_data = pd.DataFrame()
    for device_number in df['device_number'].unique():
        device_df = df[df['device_number'] == device_number]
        device_df = device_df.sort_values(by='timestamp')
        split_date = device_df['timestamp'].dt.date.iloc[0] + pd.Timedelta(
            days=20)
        mask = device_df['timestamp'].dt.date < pd.date_range(split_date, periods=1)[0].date()
        train_df = device_df[mask]
        test_df = device_df[~mask]
        train_data = pd.concat([train_data, train_df])
        test_data = pd.concat([test_data, test_df])
        # convert timestamp column to string
        train_data['timestamp'] = train_data['timestamp'].astype(str)
        test_data['timestamp'] = test_data['timestamp'].astype(str)
    print("Data split by date")
    return train_data, test_data


def upload_trained_model_to_gcs(trained_model, scaler, project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)

    # Backup previous model and scaler
    try:
        # Backup model
        fs.rename(f'{bucket_name}/{source_blob_name}', f'{bucket_name}/{datetime.now()}-{source_blob_name}')
        print("Bucket: Previous model is backed up")

        # Backup scaler
        fs.rename(f'{bucket_name}/scaler.pkl', f'{bucket_name}/{datetime.now()}-scaler.pkl')
        print("Bucket: Previous scaler is backed up")
    except:
        print("Bucket: No file to update")

    # Store new model and scaler
    # Save the model to a temporary local file
    temp_file = 'temp_model.h5'
    trained_model.save(temp_file)

    # Upload the local file to GCS bucket
    with fs.open(bucket_name + '/' + source_blob_name, 'wb') as model_handle:
        model_handle.write(open(temp_file, 'rb').read())

    # Delete the temporary local file
    os.remove(temp_file)

    with fs.open(bucket_name + '/scaler.pkl', 'wb') as scaler_handle:
        joblib.dump(scaler, scaler_handle)

    print("Trained model and scaler are uploaded to GCS bucket")


def preprocess_data(train_data, test_data):
    train_data_1 = get_other_features(train_data)
    test_data_1 = get_other_features(test_data)
    fault_train_data = add_fault_columns(train_data_1, 25, 0, 350, 50)
    fault_test_data = add_fault_columns(test_data_1, 25, 0, 350, 50)
    fault_train_data.drop('index', axis=1, inplace=True)
    fault_test_data.drop('index', axis=1, inplace=True)
    return fault_train_data, fault_test_data


def create_lstm_model(X_train, y_train, X_test, y_test):
    timesteps = X_train.shape[1]
    features = X_train.shape[2]

    # create the model
    model = Sequential()
    model.add(LSTM(16, input_shape=(timesteps, features)))
    model.add(Dropout(0.2))
    model.add(Dense(4, activation='sigmoid'))

    # compile the model
    model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])

    # train the model
    history = model.fit(X_train, y_train, epochs=10, batch_size=32, validation_split=0.2)
    loss, f1_score = model.evaluate(X_test, y_test)
    return model, history, loss, f1_score


if __name__ == '__main__':
    device_data = fetch_bigquery_data()
    train_data, test_data = split_data_by_date(device_data)
    fault_train_data, fault_test_data = preprocess_data(train_data, test_data)
    X_train, y_train, input_scaler = scale_data(fault_train_data)
    X_test, y_test, _ = scale_data(fault_test_data)
    X_train, y_train = create_dataset(X_train, y_train, 7)
    X_test, y_test = create_dataset(X_test, y_test, 7)

    model, history, loss, accuracy = create_lstm_model(X_train.astype('float32'), y_train.astype('float32'),
                                                       X_test.astype('float32'), y_test.astype('float32'))

    # save model  ans scaler to GCS
    upload_trained_model_to_gcs(model, input_scaler, configuration.GOOGLE_CLOUD_PROJECT_ID,
                                configuration.AIRQO_FAULT_DETECTION_BUCKET, 'lstm_model.h5')

    # print()
    # y_pred = evaluate_and_predict_model(model, X_test, y_test, X_new)
