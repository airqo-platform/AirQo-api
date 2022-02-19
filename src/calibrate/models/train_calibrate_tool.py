import os
from pathlib import Path
import numpy as np
import pandas as pd
import pickle
import gcsfs
import joblib
from dotenv import load_dotenv
from jobs import train_calibrate_tool

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

class Train_calibrate_tool():
    """
        The class contains functionality for computing device calibrated values .
    """

    def train_calibration_model(self,df):
        df.rename(columns={'Time':'datetime','Sensor1 PM2.5_CF_1_ug/m3':'pm2_5','Sensor2 PM2.5_CF_1_ug/m3':'s2_pm2_5',
                                     'Sensor1 PM10_CF_1_ug/m3':'pm10','Sensor2 PM10_CF_1_ug/m3':'s2_pm10',
                                     'AT(C)':'temperature', 'RH(%)':'humidity', 'ConcHR(ug/m3)':'ref_data'},inplace=True)
    
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
        # df = df.drop(['pm2_5','s2_pm2_5','pm10','s2_pm10'], axis=1)
        df_copy = df



    
        
        df['Average_PM2.5'] = df[['pm2_5', 's2_pm2_5']].mean(axis=1).round(2)
        df['Average_PM10'] = df[['pm10', 's2_pm10']].mean(axis=1).round(2)
        # filter outliers
        df = df[(df['Average_PM2.5'] > 0)&(df['Average_PM2.5'] <= 500.4)]
        df = df[(df['Average_PM10'] > 0)&(df['Average_PM10'] <= 500.4)]
        df = df[(df['ref_data'] > 0)&(df['ref'] <= 500.4)]
        df = df[(df['temperature'] >= 0)&(df ['temperature'] <= 30)]
        df = df[(df['humidity'] >= 0)&(df['humidity'] <= 100)]
        
        # df['datetime'] = df['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
        df['datetime'] = pd.to_datetime(df['datetime'])
        # df.drop_duplicates(subset="datetime", keep='first', inplace=True)
        df = df.set_index('datetime')
        df = df.drop(['datetime'], axis=1)

        df = df.resample('H').mean().round(2)
        
        df=df[(df['Average_PM2.5'].notnull())&(df['Average_PM10'].notnull())&
                                                    (df['reference_data'].notnull())].reset_index(drop=True)
                            
        df.fillna(method='ffill',inplace = True)
 
        # extract hour feature
        df['hour'] = df['datetime'].dt.hour

        # Features from PM
        # 1)"error_pm2_5" the absolute value of the difference between the two sensor values for pm2_5.
        # 2)"error_pm10","check_symbol_pm10" same as 3 and 4 but for pm10.
        # 3)"pm2.5-pm10" the difference between "Average_PM2.5" and "Average_PM10" columns
        # 4)"pm2 5-pm10_%" ratio of "pm2.5-pm10" relative to "Average_PM10"

        df["s2_pm2_5"]=np.where(df["s2_pm2_5"]==0,df["pm2_5"],df["s2_pm2_5"])
        df["s2_pm10"]=np.where(df["s2_pm10"]==0,df["pm10"],df["s2_pm10"])
        df["error_pm10"]=np.abs(df["pm10"]-df["s2_pm10"])
        df["error_pm2_5"]=np.abs(df["pm2_5"]-df["s2_pm2_5"])
        df["pm2_5_pm10"]=df["Average_PM2.5"]-df["Average_PM10"]
        df["pm2_5_pm10_mod"]=df["pm2_5_pm10"]/df["Average_PM10"]

        combined_ext_data = df[['Average_PM2.5','Average_PM10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod', 'reference_data']]
     
        model_pm2_5 = train_calibrate_tool.random_forest(combined_ext_data)
        model_pm10 = train_calibrate_tool.lasso_reg(combined_ext_data)

        return model_pm2_5, model_pm10
               
if __name__ == "__main__":
    calibrateInstance = Train_calibrate_tool()
