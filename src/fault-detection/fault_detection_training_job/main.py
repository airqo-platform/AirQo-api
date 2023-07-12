import numpy as np
import pandas as pd
import datetime
from utils import date_to_str, upload_trained_model_to_gcs
from google.oauth2 import service_account
from config import configuration
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, TimeDistributed
import tensorflow as tf
from keras.callbacks import EarlyStopping


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    credentials = service_account.Credentials.from_service_account_file(
        configuration.CREDENTIALS)
    start_date = datetime.datetime.utcnow() - datetime.timedelta(days=int(configuration.NUMBER_OF_DAYS))
    start_date = date_to_str(start_date, format='%Y-%m-%d')

    query = f"""
            SELECT DISTINCT timestamp , site_id, device_number, s1_pm2_5, s2_pm2_5 
            FROM `{configuration.GOOGLE_CLOUD_PROJECT_ID}.raw_data.device_measurements` 
            WHERE DATE(timestamp) >= '{start_date}' AND device_number IS NOT NULL
            ORDER BY timestamp 
    """

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
        df1['high_var_fault'] = ((df1['s1_pm2_5'].rolling(7).std() > highvar_threshold) | (
                df1['s2_pm2_5'].rolling(7).std() > highvar_threshold)).astype(int)
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


def scale_data(df1, df2):
    """
    scales data using MinMaxScaler
    """
    dfs = [df1, df2]

    scaled_inputs = []
    additional_features = []
    targets = []

    input_scaler = MinMaxScaler()

    for df in dfs:
        inputs = df.iloc[:, : 3].values
        additional_features.append(df.iloc[:, 3:-3].values)
        targets.append(df.iloc[:, -3:].values)
        input_scaler.fit(inputs)
        scaled_inputs.append(input_scaler.transform(inputs))

    scaled_inputs = [np.concatenate((scaled_input, feature), axis=1) for scaled_input, feature in
                     zip(scaled_inputs, additional_features)]

    print("Data scaled")

    return scaled_inputs[0], targets[0], scaled_inputs[1], targets[1], input_scaler


def create_3d_lstm_array(x, y, time_steps, labels):
    y_3d = np.reshape(y, (-1, time_steps, labels))
    x_3d = []
    device_nums = np.unique(x[:, 0])
    for device_num in device_nums:
        mask = x[:, 0] == device_num
        features = x[mask, :]
        x_3d.append(features)
    x_3d = np.array(x_3d)
    return x_3d, y_3d


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
            days=5)
        mask = device_df['timestamp'].dt.date < pd.date_range(split_date, periods=1)[0].date()
        train_df = device_df[mask]
        test_df = device_df[~mask]
        train_data = pd.concat([train_data, train_df])
        test_data = pd.concat([test_data, test_df])
        # convert timestamp column to string
    print("Data split by date")
    return train_data, test_data

def preprocess_data(train_data, test_data):
    train_data_1 = get_other_features(train_data)
    test_data_1 = get_other_features(test_data)
    fault_train_data = add_fault_columns(train_data_1, 15, 0, 200, 25)
    fault_test_data = add_fault_columns(test_data_1, 15, 0, 200, 25)
    fault_train_data.drop('index', axis=1, inplace=True)
    fault_test_data.drop('index', axis=1, inplace=True)
    return fault_train_data, fault_test_data


def create_lstm_model(x1, y1, x2, y2):
    timesteps = x1.shape[1]
    features = x1.shape[2]

    # create the model
    model = Sequential()
    model.add(LSTM(50, input_shape=(timesteps, features), return_sequences=True))
    model.add(Dropout(0.2))
    model.add(TimeDistributed(Dense(3, activation='sigmoid')))

    optimizer = tf.keras.optimizers.Adam(learning_rate=0.1)

    model.compile(loss='binary_crossentropy', optimizer=optimizer, metrics=['accuracy'])
    history = model.fit(x1, y1, epochs=10, batch_size=14, validation_split=0.2,
                        callbacks=[EarlyStopping(monitor='val_loss', patience=3)
                                   ])
    loss, accuracy = model.evaluate(x2, y2)
    print(model.summary())
    return model, history, loss, accuracy


if __name__ == '__main__':
    device_data = fetch_bigquery_data()
    train_data, test_data = split_data_by_date(device_data)
    fault_train_data, fault_test_data = preprocess_data(train_data, test_data)
    # store the forst value of the device number column in a variable
    device_number_1 = fault_train_data['device_number'].iloc[0]
    device_number_2 = fault_test_data['device_number'].iloc[0]
    no_of_rows_train = fault_train_data[fault_train_data['device_number'] == device_number_1].shape[0]
    no_of_rows_test = fault_test_data[fault_test_data['device_number'] == device_number_2].shape[0]
    X_train, y_train, X_test, y_test, input_scaler = scale_data(fault_train_data, fault_test_data)

    X_train_3D, y_train_3D = create_3d_lstm_array(X_train, y_train, no_of_rows_train, 3)
    X_test_3D, y_test_3D = create_3d_lstm_array(X_test, y_test, no_of_rows_test, 3)
    model, history, loss, accuracy = create_lstm_model(X_train_3D.astype('float32'), y_train_3D.astype('float32'),
                                                       X_test_3D.astype('float32'), y_test_3D.astype('float32'))

    upload_trained_model_to_gcs(model, input_scaler, configuration.GOOGLE_CLOUD_PROJECT_ID,
                                configuration.AIRQO_FAULT_DETECTION_BUCKET, 'lstm_model.keras')

    # print()
    # y_pred = evaluate_and_predict_model(model, X_test, y_test, X_new)
