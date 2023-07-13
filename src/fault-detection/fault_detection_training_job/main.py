import numpy as np
import pandas as pd
import datetime
from utils import date_to_str, upload_trained_model_to_gcs
from google.oauth2 import service_account
import tensorflow as tf
from bayes_opt import BayesianOptimization
from config import configuration
from sklearn.preprocessing import MinMaxScaler
from keras.models import Sequential
from keras.layers import LSTM, Dense, Dropout, TimeDistributed
from keras.callbacks import EarlyStopping


def fetch_bigquery_data():
    """gets data from the bigquery table"""
    credentials = service_account.Credentials.from_service_account_file(
        configuration.CREDENTIALS)

    query = f"""
    SELECT DISTINCT device_number, timestamp, s1_pm2_5, s2_pm2_5 FROM `{configuration.BIGQUERY_TABLE}` 
WHERE DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)  ORDER BY device_number, timestamp DESC
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

    scaler = MinMaxScaler()

    for df in dfs:
        inputs = df.iloc[:, : 3].values
        additional_features.append(df.iloc[:, 3:-3].values)
        targets.append(df.iloc[:, -3:].values)
        scaler.fit(inputs)
        scaled_inputs.append(scaler.transform(inputs))

    scaled_inputs = [np.concatenate((scaled_input, feature), axis=1) for scaled_input, feature in
                     zip(scaled_inputs, additional_features)]

    print("Data scaled")

    return scaled_inputs[0], targets[0], scaled_inputs[1], targets[1], scaler


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


def split_data_by_device_number(df):
    """
    splits data by date for each device
    """
    device_numbers = df['device_number'].unique()
    np.random.shuffle(device_numbers)
    train_device_numbers = device_numbers[:int(len(device_numbers) * 0.8)]
    test_device_numbers = device_numbers[int(len(device_numbers) * 0.8):]

    train_df = df[df['device_number'].isin(train_device_numbers)]
    test_df = df[df['device_number'].isin(test_device_numbers)]

    return train_df, test_df


def preprocess_data(train_data, test_data):
    train_data_1 = get_other_features(train_data)
    test_data_1 = get_other_features(test_data)
    fault_train_data = add_fault_columns(train_data_1, 15, 0, 200, 25)
    fault_test_data = add_fault_columns(test_data_1, 15, 0, 200, 25)
    fault_train_data.drop('index', axis=1, inplace=True)
    fault_test_data.drop('index', axis=1, inplace=True)
    return fault_train_data, fault_test_data


# def create_lstm_model(x1, y1, x2, y2):
#     timesteps = x1.shape[1]
#     features = x1.shape[2]
#
#     # create the model
#     model = Sequential()
#     model.add(LSTM(50, input_shape=(timesteps, features), return_sequences=True))
#     model.add(Dropout(0.2))
#     model.add(TimeDistributed(Dense(3, activation='sigmoid')))
#
#     optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
#
#     model.compile(loss='binary_crossentropy', optimizer=optimizer, metrics=['accuracy'])
#     history = model.fit(x1, y1, epochs=10, batch_size=14, validation_split=0.2,
#                         callbacks=[EarlyStopping(monitor='val_loss', patience=3)
#                                    ])
#     loss, accuracy = model.evaluate(x2, y2)
#     print(model.summary())
#     return model, history, loss, accuracy
# Define a function that performs Bayesian optimization on the LSTM model
def optimize_lstm_model(x1, y1, x2, y2):
    # Define a function that creates and compiles the model
    def create_lstm_model(learning_rate):
        timesteps = x1.shape[1]
        features = x1.shape[2]
        model = Sequential()
        model.add(LSTM(50, input_shape=(timesteps, features), return_sequences=True))
        model.add(Dropout(0.2))
        model.add(TimeDistributed(Dense(3, activation='sigmoid')))
        optimizer = tf.keras.optimizers.Adam(learning_rate=learning_rate)
        model.compile(loss='binary_crossentropy', optimizer=optimizer, metrics=['accuracy'])
        return model

    # Define a function that trains and evaluates the model
    def train_evaluate(learning_rate, epochs, batch_size):
        # Convert the hyperparameters to integers
        epochs = int(epochs)
        batch_size = int(batch_size)

        # Create and fit the model
        model = create_lstm_model(learning_rate)
        history = model.fit(x1, y1, epochs=epochs, batch_size=batch_size, validation_split=0.2,
                            callbacks=[EarlyStopping(monitor='val_loss', patience=3)
                                       ])

        # Evaluate the model on the test data
        loss, accuracy = model.evaluate(x2, y2)

        # Return the negative accuracy as the objective to be minimized
        return -accuracy

    # Define the bounds of the hyperparameters
    pbounds = {
        'learning_rate': (0.01, 0.2),
        'epochs': (5, 15),
        'batch_size': (8, 20)
    }

    # Create a BayesianOptimization object
    optimizer = BayesianOptimization(
        f=train_evaluate,
        pbounds=pbounds,
        random_state=42,
    )

    # Perform the optimization with 10 initial points and 20 subsequent points
    optimizer.maximize(
        init_points=10,
        n_iter=20,
    )

    # Print the best hyperparameters and score
    print(optimizer.max)

    # Retrieve the best hyperparameters
    best_learning_rate = optimizer.max['params']['learning_rate']
    best_epochs = int(optimizer.max['params']['epochs'])
    best_batch_size = int(optimizer.max['params']['batch_size'])

    # Create and fit the best model
    best_model = create_lstm_model(best_learning_rate)
    best_history = best_model.fit(x1, y1, epochs=best_epochs, batch_size=best_batch_size, validation_split=0.2,
                                  callbacks=[EarlyStopping(monitor='val_loss', patience=3)
                                             ])

    # Evaluate the best model on the test data
    best_loss, best_accuracy = best_model.evaluate(x2, y2)

    # Return the best model, accuracy, history, and loss
    return best_model, best_accuracy, best_history, best_loss


if __name__ == '__main__':
    device_data = fetch_bigquery_data()
    train_data, test_data = split_data_by_device_number(device_data)
    fault_train_data, fault_test_data = preprocess_data(train_data.copy(), test_data.copy())
    # store the forst value of the device number column in a variable
    device_number_1 = fault_train_data['device_number'].iloc[0]
    device_number_2 = fault_test_data['device_number'].iloc[0]
    no_of_rows_train = fault_train_data[fault_train_data['device_number'] == device_number_1].shape[0]
    no_of_rows_test = fault_test_data[fault_test_data['device_number'] == device_number_2].shape[0]
    X_train, y_train, X_test, y_test, input_scaler = scale_data(fault_train_data, fault_test_data)

    X_train_3D, y_train_3D = create_3d_lstm_array(X_train, y_train, no_of_rows_train, 3)
    X_test_3D, y_test_3D = create_3d_lstm_array(X_test, y_test, no_of_rows_test, 3)
    model, history, loss, accuracy = optimize_lstm_model(X_train_3D.astype('float32'), y_train_3D.astype('float32'),
                                                         X_test_3D.astype('float32'), y_test_3D.astype('float32'))
    print(model.summary())
    upload_trained_model_to_gcs(model, input_scaler, configuration.GOOGLE_CLOUD_PROJECT_ID,
                                configuration.AIRQO_FAULT_DETECTION_BUCKET, 'lstm_model.keras')

    # print()
    # y_pred = evaluate_and_predict_model(model, X_test, y_test, X_new)
