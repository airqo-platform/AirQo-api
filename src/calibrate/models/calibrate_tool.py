import os
from pathlib import Path
import numpy as np
import pandas as pd
import pickle
import gcsfs
import joblib
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

RF_REG_MODEL = os.getenv('RF_REG_MODEL', 'jobs/rf_reg_model.pkl')
LASSO_MODEL = os.getenv('LASSO_MODEL', 'jobs/lasso_model.pkl')

class Regression():
    """
        The class contains functionality for computing device calibrated values .
    """
  
    def compute_calibrated_val(self, df):  
 
        df.rename(columns={'Time':'datetime','Sensor1 PM2.5_CF_1_ug/m3':'pm2_5','Sensor2 PM2.5_CF_1_ug/m3':'s2_pm2_5',
                                     'Sensor1 PM10_CF_1_ug/m3':'pm10','Sensor2 PM10_CF_1_ug/m3':'s2_pm10',
                                     'AT(C)':'temperature', 'RH(%)':'humidity'},inplace=True)
    
        # features from datetime and PM
        df["datetime"] = pd.to_datetime(df["datetime"])
        # extract hour
        df['hour'] =  df['datetime'].dt.hour
    
        df["avg_pm2_5"] = df[['pm2_5','s2_pm2_5']].mean(axis=1).round(2)
        df["avg_pm10"] =  df[['pm10','s2_pm10']].mean(axis=1).round(2)
        df["error_pm10"]=np.abs(df["pm10"]-df["s2_pm10"])
        df["error_pm2_5"]=np.abs(df["pm2_5"]-df["s2_pm2_5"])
        df["pm2_5_pm10"]=df["avg_pm2_5"]-df["avg_pm10"]
        df["pm2_5_pm10_mod"]=df["pm2_5_pm10"]/df["avg_pm10"]
        df = df.drop(['pm2_5','s2_pm2_5','pm10','s2_pm10'], axis=1)
        
        df = df[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']]
        
        print("df", df)
        #load model from disk
        rf_regressor = pickle.load(open(RF_REG_MODEL, 'rb'))
        lasso_regressor = pickle.load(open(LASSO_MODEL, 'rb'))
        # # load model from GCP 
        # rf_regressor = self.get_model('airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')
        calibrated_pm2_5 =  rf_regressor.predict(df)
        calibrated_pm10 =  lasso_regressor.predict(df)
        # datetime = df["datetime"]  
        return calibrated_pm2_5, calibrated_pm10
               
if __name__ == "__main__":
    calibrateInstance = Regression()
