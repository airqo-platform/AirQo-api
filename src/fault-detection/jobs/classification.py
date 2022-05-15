import pandas as pd
import numpy as np
import datetime
from sklearn.ensemble import RandomForestRegressor 
from sklearn.linear_model import Lasso
import pickle
from sklearn.preprocessing import StandardScaler
import os
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

from keras.models import Sequential
from keras.layers import LSTM, Activation, Dropout,Dense

# BASE_DIR = Path(__file__).resolve().parent
# dotenv_path = os.path.join(BASE_DIR, '.env')
# print(dotenv_path)
load_dotenv()


LSTM_MODEL = os.getenv('LSTM_MODEL','jobs/lstm_model')
SCALER = os.getenv('SCALER','jobs/scaler.pkl')

MONGO_URI = os.getenv('MONGO_URI')
client = MongoClient(MONGO_URI)
train_data = client.fault_detection.train_data

train_df = pd.DataFrame(list(train_data.find()))

def lstm_model(dataset):
    # dataset.sort_values(by=['Datetime']).reset_index(drop=True)
    # dataset['Datetime'] = pd.to_datetime(dataset.Datetime)
    # dataset['Datetime_day'] = dataset.Datetime.dt.day
    # dataset['Datetime_month'] = dataset.Datetime.dt.month
    # dataset['Datetime_hour'] = dataset.Datetime.dt.hour
    print(dataset)
    dataset.fillna(-9999, inplace=True)
    X= dataset[['Sensor1_PM2.5','Sensor2_PM2.5']].values
    y = dataset[['Offset_fault','Out_of_bounds_fault','Data_loss_fault','High_variance_fault']].values    
    scaler = StandardScaler()
    X = scaler.fit_transform(X)
    model = Sequential()
    model.add(LSTM(50, activation='linear', input_shape=(2, 1)))
    model.add(Dense(4,activation='sigmoid'))
    model.compile(optimizer='adam', loss='binary_crossentropy',metrics = 'accuracy')
    # fit model
    model.fit(X, y,epochs=1, verbose=0,batch_size = 128)

    filename = LSTM_MODEL

    file = open(SCALER, 'wb')
    pickle.dump(scaler, file)
    # close the file
    file.close()
    model.save(f'{filename}.h5')
    ##dump the model to google cloud storage.
    # save_trained_model(rf_regressor,'airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')

    
    return model



if __name__ == "__main__":
    lstm_class = lstm_model(train_df)
