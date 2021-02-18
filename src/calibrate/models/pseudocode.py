#format 
import pandas as pd
import numpy as np
import pickle
from datetime import datetime,timedelta
#import matplotlib.pyplot as plt
#import download_airnow_web
#import pyproj
from scipy.optimize import curve_fit
import networkx as nx
from calibration.errormetrics import MAE, MSE, NMSE, NLPD, compute_test_data
from calibration.simple import compute_simple_calibration,compute_simple_predictions, plot_simple_calibration_graph
from os import path
def map_channel_ids()
def compute_all_log_ratios():
    """
     computes the log ratios for all the devices.
     1. read in encounters and processed data  with distances, northings & eastings
     2. process data into formart accepted by computing calibrations(log ratios)
     3 . call the method that does the actual computation
     4.  update  the results to use actual device id's instead of matrix indices
       {map the channelid into dictionary} ..the value we have is the index in unq array.
     5.  save log ratios
    """

    df = pickle.load(open(path.join('data','alldataprocessed.p'),'rb'))
    encounters = pickle.load(open(path.join('data','encounters.p'),'rb'))

    #this gets rid of unwanted cases where the reference sensors = -1000!
    keep=((encounters['pm2_5_sensorA']>=0) & (encounters['pm2_5_sensorB']>=0))
    encounters = encounters[keep]
    unq = df['channel_id'].unique()


    t = (encounters['created_at']-pd.Timestamp('2020-07-15',tz='UTC')).dt.total_seconds()/3600 #hours since 15th July
    idA = [np.where(a==unq)[0][0] for a in encounters['channel_id_sensorA']]
    idB = [np.where(a==unq)[0][0] for a in encounters['channel_id_sensorB']]
    sA = np.nanmean(encounters[['pm2_5_sensorA','s2_pm2_5_sensorA']],1)
    sB = np.nanmean(encounters[['pm2_5_sensorB','s2_pm2_5_sensorB']],1)
    X = np.c_[t,idA,idB]
    Y = np.c_[sA,sB]

    
    refsensor = np.zeros(len(unq))
    refsensor[-1]=1
    #refsensor[-2]=1

    #This makes it so the smaller id is always first in the pair
    swaps = X[:,2]<X[:,1]
    X[swaps,1],X[swaps,2] = X[swaps,2],X[swaps,1]
    Y[swaps,1],Y[swaps,0] = Y[swaps,0],Y[swaps,1]

    #Average blocks of 10 data
    newX = []
    newY = []

    print(X)
    print(X.shape)
    print("end of initial x")
    for i in range(0,len(X)-9,10):
        if np.any(X[i:(i+9),1]!=X[(i+1):(i+10),1]): continue
        if np.any(X[i:(i+9),2]!=X[(i+1):(i+10),2]): continue
        newX.append(np.mean(X[i:(i+10),:],0))
        newY.append(np.mean(Y[i:(i+10),:],0))
    X = np.array(newX)
    Y = np.array(newY)

    delta = 24*40

    G,allsp,allcals,allcallists,allpopts,allpcovs,allpoptslists = compute_simple_calibration(X,Y,delta,refsensor)

    return allcals


def compute_log_ratios(self, device_name):
    """
    get the distance using GPS cordinates
    compute the ratios
    How frequent will the job run? a day?
    """
    gps = get_gps(device_name)
    log_ratio = generate_ratio(gps, mobile)

    

    save_log_ratio(device_name, log_ratio)
    # stored in the log_ratios collection
    # {
    #   created_attime: #time when the value was recorded..(dividing it by delta)
    #   id:
    #   log_ratio: 2131
    #   device_name: aq_01,
    #   idx
    # }

    { unq[index]:(value, timestamp) for (index, timestamp), value in allcals.items()}

    #{
        alllogratios: {}

    }

def compute_calibration(self, raw_value, datetime, device_name):
    """
    Assumption is that the log ratios were stored/updated in the components collection
    we get the log ratio using the sensor/component ID
    """
    device_name = get_device_name(sensor_id)
    log_ratio = log_ratio_model(device_name)
    calibrated_value = float(raw_value) * log_ratio
    result = {"calibrated_value": calibrated_value,
                "calibrated_standard_error": calibrated_standard_error, "sensor_id": sensor_id}
    return result

def store_calibraton(self, sensor_id, calibrated_value):
    """
    Store the calibration inside the Events collection
    """
    Events(calibrated_value, sensor_id)


if __name__ == '__main__':
    results = compute_all_log_ratios()
    print(results)


    

