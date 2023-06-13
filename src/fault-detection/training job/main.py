import numpy as np
import pandas as pd
from google.oauth2 import service_account
from config import configuration
from keras.models import Sequential
from keras.layers import Bidirectional, LSTM, Dense
from sklearn.preprocessing import MinMaxScaler
# import gcsfs
from datetime import datetime
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

        df1['high_var_fault'] = (df1['s1_pm2_5'].rolling(10).std() > highvar_threshold) | (
                df1['s2_pm2_5'].rolling(10).std() > highvar_threshold) * 1

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


def create_dataset(df, window_size):
    """
    creates a dataset for LSTM training from a dataframe
    """
    X = []
    y = []
    for i in range(len(df) - window_size):
        X.append(df.iloc[i:i + window_size, :-4].values)
        y.append(
            df.iloc[i + window_size - 1, -4:].values)
    X = np.array(X)
    y = np.array(y)
    return X, y


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
    return train_data, test_data


def reshape_and_scale_data(train_data, test_data):
    """ Reshapes and scales data """
    window_size = 480
    scaler = MinMaxScaler()

    def process_data(data, fit=False):
        X_list = []
        y_list = []
        for device in data["device_number"].unique():
            X, y = create_dataset(data[data["device_number"] == device], window_size)
            X = X.reshape(-1, window_size, data.shape[1] - 4)
            if fit:
                X = scaler.fit_transform(X)
            else:
                X = scaler.transform(X)
            X_list.append(X)
            y_list.append(y)

        # Concatenate lists
        X_array = np.concatenate(X_list, axis=0)
        y_array = np.concatenate(y_list, axis=0)
        return X_array, y_array

    # Process train and test data
    X_train, y_train = process_data(train_data, fit=True)
    X_test, y_test = process_data(test_data)

    return X_train, y_train, X_test, y_test


def build_and_train_model(X_train, y_train):
    """
    builds and trains LSTM model
    """
    model = Sequential()
    model.add(Bidirectional(LSTM(64)))  # choose a suitable number of hidden units
    model.add(Dense(4, activation='sigmoid'))  # choose a suitable activation function for binary classification
    model.compile(loss='binary_crossentropy', optimizer='adam',
                  metrics=['accuracy'])  # choose a suitable loss function and optimizer
    model.fit(X_train, y_train, epochs=10, batch_size=32)  # choose suitable number of epochs and batch size
    return model


def evaluate_and_predict_model(model, X_test, y_test, X_new):
    """
    evaluates and predicts with LSTM model
    """
    model.evaluate(X_test, y_test)
    y_pred = model.predict(X_new)  # change X_new as needed
    return y_pred


def preprocess_data(train_data, test_data):
    train_data = get_other_features(train_data)
    test_data = get_other_features(test_data)
    fault_train_data = add_fault_columns(train_data, 25, 0, 350, 50)
    fault_test_data = add_fault_columns(test_data, 25, 0, 350, 50)
    return fault_train_data, fault_test_data


if __name__ == '__main__':
    device_data = fetch_bigquery_data()
    train_data, test_data = split_data_by_date(device_data)
    fault_train_data, fault_test_data = preprocess_data(train_data, test_data)
    X_train, y_train, X_test, y_test = reshape_and_scale_data(fault_train_data, fault_test_data)
    model = build_and_train_model(X_train, y_train)
    print(model)
    # y_pred = evaluate_and_predict_model(model, X_test, y_test, X_new)
