import numpy as np
import pandas as pd
import os
import pickle
from pymongo import MongoClient
from helpers import dataprocessing as dp 
from helpers import simple as sp  
from datetime import datetime,timedelta

# MONGO_URI = os.getenv('MONGO_URI')
# client = MongoClient(MONGO_URI)
# db = client['airqo_netmanager_staging_airqo']
# col = db['calibration_ratios']



class Calibrate():
    """
        The class contains functionality for computing device calibrated values .
    """
    def __init__(self):
        """ initialize """

        with open('models/encounters.p','rb') as pickle_file:
            encounters = pickle.load(pickle_file)
            self.allcals, self.myDict_id = self.calibrate_raw_data(encounters)

    def calibrate_raw_data(self, encounters):
        unq = np.unique(np.r_[encounters['channel_id_sensorA'].unique(),encounters['channel_id_sensorB'].unique()])
        t = (encounters['created_at']-pd.Timestamp('2020-07-15',tz='UTC')).dt.total_seconds()/3600 #hours since 15th July put to 1970 and substract some dates
        idA = [np.where(a==unq)[0][0] for a in encounters['channel_id_sensorA']]
        idB = [np.where(a==unq)[0][0] for a in encounters['channel_id_sensorB']]
        sA = np.nanmean(encounters[['pm2_5_sensorA','s2_pm2_5_sensorA']],1)
        sB = np.nanmean(encounters[['pm2_5_sensorB','s2_pm2_5_sensorB']],1)
        X = np.c_[t,idA,idB]
        Y = np.c_[sA,sB]

        newids = set(idA+idB)
        myDict_id = dict(zip(newids, unq))

        refsensor = np.zeros(len(unq))
        refsensor[2]=1
        f = sp.f
        delta = 24*7
        G,allsp,allcals,allcallists,allpopts,allpcovs,allpoptslists = sp.compute_simple_calibration(X,Y,delta,refsensor)
        return allcals, myDict_id

   
    
    # file = open('models/log_ratios', 'wb')
    # pickle.dump(allcals, file)

    
  
    def calibrate_sensor_raw_data(self, datetime, sensor_id, raw_value):
        
        delta = 24*7

        datetime = pd.Timestamp(datetime, tz='UTC')
        time_in_secs = (datetime-pd.Timestamp('2020-07-15',tz='UTC')).total_seconds()/3600  
        time = time_in_secs/delta
        #cid = myDict_id.get(sensor_id)
    
        time = np.array([[float(time)]])
        cid = np.array([[float(sensor_id)]])
        value = np.array([[float(raw_value)]])

        testX = np.concatenate((time, cid, value), axis=1)
        res,scale,preds,key = sp.compute_simple_predictions(testX,self.allcals,delta)

        if (not preds):
            return none

        return preds[0]

if __name__ == "__main__":
    calibrateInstance = Calibrate()
# a = Calibrate()
# a.calibrate_raw_data(encounters)