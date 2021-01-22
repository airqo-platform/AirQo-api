import numpy as np
import os
from helpers import dataprocessing as dp #processBAMdata, loaddata, combinedatasets, build_encounters
from helpers import simple as sp  #f, compute_simple_calibration, compute_simple_predictions

# MONGO_URI = os.getenv("MONGO_URI")
# client = MongoClient(MONGO_URI)
# db = client['airqo_netmanager_staging_airqo']


class Calibrate():
    """
        The class contains functionality for computing device calibrated values .
    """
    def __init__(self):
        """ initialize """

   
    def get_values(self):
        allbamdf = dp.processBAMdata
        df = dp.loaddata
        dataset = dp.combinedatasets
        encounters = dp.build_encounters   
        return encounters


    def calibrate_raw_data(self):
        unq = np.unique(np.r_[encounters['channel_id_sensorA'].unique(),encounters['channel_id_sensorB'].unique()])
        t = (encounters['created_at']-pd.Timestamp('2020-07-15',tz='UTC')).dt.total_seconds()/3600 #hours since 15th July put to 1970 and substract some dates
        idA = [np.where(a==unq)[0][0] for a in encounters['channel_id_sensorA']]
        idB = [np.where(a==unq)[0][0] for a in encounters['channel_id_sensorB']]
        sA = np.nanmean(encounters[['pm2_5_sensorA','s2_pm2_5_sensorA']],1)
        sB = np.nanmean(encounters[['pm2_5_sensorB','s2_pm2_5_sensorB']],1)
        X = np.c_[t,idA,idB]
        Y = np.c_[sA,sB]
        refsensor = np.zeros(len(unq))
        refsensor[2]=1
        f = sp.f
        G,allsp,allcals,allcallists,allpopts,allpcovs,allpoptslists = sp.compute_simple_calibration
        print(allcals)
        return allcals

    
    def calibrate_sensor_raw_data(self, raw_value, datetime, sensor_id):
        delta = 24*7
        testX = np.c_[datetime, sensor_id,raw_value]
        res,scale,preds,key = sp.compute_simple_predictions
        result = {"calibrated_value": preds} #, "calibrated_standard_error": calibrated_standard_error
        print(result)
        return result

if __name__ == "__main__":
    calibrateInstance = Calibrate()
    # #results = calibrateInstance.sample(2,3)
    # results = calibrateInstance.calibrate_sensor_raw_data(74,'2020-12-01',23)
    # print(results)