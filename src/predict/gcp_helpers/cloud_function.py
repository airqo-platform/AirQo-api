import json
import requests
from google.cloud import storage
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import os
import glob
import gpflow
from gpflow.utilities import print_summary
from gpflow import set_trainable
import tensorflow as tf
from gpflow.config import default_float
from pandas import Timestamp
import pymongo
from pymongo import MongoClient
from dotenv import load_dotenv
import math
load_dotenv()


storage_client = storage.Client('AirQo-e37846081569.json')
MONGO_URI = os.getenv("MONGO_URI")

def get_channels():
    '''
    Gets details of channels whose data is to be used in training
    '''
    blob = storage_client.get_bucket('api-keys-bucket') \
        .get_blob('kampala-api-keys.json') \
        .download_as_string()
    return json.loads(blob)

def download_seven_days(channel_id, api_key):
    '''
    Downloads data from ThingSpeak for a specific channel for the past week
    '''
    channel_data = []
    result = 8000
    end_time = datetime.utcnow()
    start_time = end_time-timedelta(days=7)
    start = datetime.strftime(start_time, '%Y-%m-%dT%H:%M:%SZ')
    end = datetime.strftime(end_time, '%Y-%m-%dT%H:%M:%SZ')
    base_url = f'https://api.thingspeak.com/channels/{channel_id}/feeds.json'
    
    while (end_time > start_time) and (result==8000):
        channel_url = base_url+'?start='+start+'&end='+end
        print(channel_url)
        data = json.loads(requests.get(channel_url, timeout = 100.0).content.decode('utf-8'))
        if (data!=-1 and len(data['feeds'])>0):
            channel_data.extend(data['feeds'])
            end = data['feeds'][0]['created_at']
            result = len(data['feeds'])
            print(result)
            end_time = datetime.strptime(end, '%Y-%m-%dT%H:%M:%SZ') - timedelta(seconds=1)
        else:
            return pd.DataFrame()
    return pd.DataFrame(channel_data)

def preprocessing(df):
    '''
    Preprocesses data for a particular channel
    '''
    df = df.drop_duplicates()
    df['field1'].fillna(df['field3'], inplace=True)
    df = df[['created_at','field1']]
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['field1'] = pd.to_numeric(df['field1'], errors='coerce')
    df = df.sort_values(by='created_at',ascending=False)
    df = df.set_index('created_at')
    hourly_df = df.resample('H').mean()
    hourly_df.dropna(inplace=True)
    hourly_df= hourly_df.reset_index()

    return hourly_df


def train_model(X, Y):
    '''
    Creates a model, trains it using given data and saves it for future use
    '''
    print('training model function')
    Yset = Y
    Yset[Yset==0] = np.nan
    
    keep = ~np.isnan(Yset[:,0]) 
    Yset = Yset[keep,:]
    Xset = X[keep,:]
    print('Number of rows in Xset', Xset.shape[0])
    
    Xtraining = Xset[::2,:]
    Ytraining = Yset[::2,:]

    print('Number of rows in Xtraining', Xtraining.shape[0])
    
    print('creating kernel')
    k = gpflow.kernels.RBF(lengthscales=[0.08, 0.08, 2]) + gpflow.kernels.Bias()
    print('creating model')
    m = gpflow.models.GPR(data=(Xtraining, Ytraining), kernel=k, mean_function=None)
    print('setting trainable lengthscales to false ')
    set_trainable(m.kernel.kernels[0].lengthscales, False) 
   
    opt = gpflow.optimizers.Scipy()

    def objective_closure():
             return - m.log_marginal_likelihood()

    print('optimization')
    opt_logs = opt.minimize(objective_closure, m.trainable_variables, options=dict(maxiter=100))

    return m

def predict_model(m):
    '''
    Makes the predictions and stores them in a database
    '''
    time = datetime.now().replace(microsecond=0, second=0, minute=0).timestamp()/3600
    min_long, max_long, min_lat, max_lat = 32.4, 32.8, 0.1, 0.5

    longitudes = np.linspace(min_long, max_long, 100)
    latitudes = np.linspace(min_lat, max_lat, 100)
    locations = np.meshgrid(longitudes, latitudes)
    locations_flat = np.c_[locations[0].flatten(),locations[1].flatten()]
    pred_set = np.c_[locations_flat,np.full(locations_flat.shape[0],time)]
    mean, var = m.predict_f(pred_set)
    
    means = mean.numpy().flatten()
    variances = var.numpy().flatten()
    std_dev = np.sqrt(variances)
    # calculate prediction interval
    interval = 1.96 * std_dev
    # lower, upper = means - interval, means + interval
        
    result = []
    for i in range(pred_set.shape[0]):
        result.append({'latitude':locations_flat[i][1],
                      'longitude':locations_flat[i][0],
                      'predicted_value': means[i],
                      'variance':variances[i],
                      'interval':interval[i]})

    try:
        client = MongoClient(MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        return {'message':'unable to connect to database', 'success':False}, 400
    db = client['airqo_netmanager_airqo']
    collection = db['gp_predictions']
    
    if collection.count_documents({})!= 0:
        collection.delete_many({})
    
    collection.insert_many(result)

    return result

def periodic_function():
    '''
    Re-trains the model regularly
    '''
    X = np.zeros([0,3])
    Y = np.zeros([0,1])
    channels = get_channels()
    for channel in channels:
        d = download_seven_days(channel['id'], channel['api_key'])
        if d.shape[0]!=0:
            d = preprocessing(d)
            df = pd.DataFrame({'channel_id':[channel['id']], 
                               'longitude':[channel['long']], 
                               'latitude':[channel['lat']]})
        
            Xchan = np.c_[np.repeat(np.array(df)[:,1:],d.shape[0],0),[n.timestamp()/3600 for n in d['created_at']]]
            Ychan = np.array(d['field1'])
            X = np.r_[X,Xchan]
            Y = np.r_[Y,Ychan[:, None]]
    m = train_model(X, Y)
    predict_model(m)


if __name__ == "__main__":
    periodic_function()