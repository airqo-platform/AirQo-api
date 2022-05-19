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


load_dotenv()


LSTM_MODEL = os.getenv('LSTM_MODEL','jobs/lstm_model')
SCALER = os.getenv('SCALER','jobs/scaler.pkl')

MONGO_URI = os.getenv('MONGO_URI')
client = MongoClient(MONGO_URI)
train_data = client.fault_detection.train_data

train_df = pd.DataFrame(list(train_data.find()))

def lstm_model(dataset):
    
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

    return model



if __name__ == "__main__":
    lstm_class = lstm_model(train_df)
