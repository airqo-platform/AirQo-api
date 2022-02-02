import os
from pathlib import Path
import numpy as np
import pandas as pd
import pickle
import gcsfs
import joblib
from dotenv import load_dotenv
from jobs import calibrate_tool

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)


# PM2_5_TOOL = os.getenv('PM2_5_TOOL', 'jobs/pm2_5_tool.pkl')
# PM10_TOOL = os.getenv('PM10_TOOL', 'jobs/pm10_tool.pkl')

class Calibrate_tool():
    """
        The class contains functionality for computing device calibrated values .
    """

    def train_calibration_model(self,pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime, reference_data): 
        ext_data = pd.DataFrame([[pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity,datetime,reference_data]],
                                        columns=['pm2_5','s2_pm2_5','pm10','s2_pm10','temperature','humidity','datetime','reference_data'],
                                        dtype='float',
                                        index=['input'])
        
        ext_data['Average_PM2.5'] = ext_data[['pm2_5', 's2_pm2_5']].mean(axis=1).round(2)
        ext_data['Average_PM10'] = ext_data[['pm10', 's2_pm10']].mean(axis=1).round(2)
        # filter outliers
        ext_data = ext_data[(ext_data['Average_PM2.5'] > 0)&(ext_data['Average_PM2.5'] <= 500.4)]
        ext_data = ext_data[(ext_data['Average_PM10'] > 0)&(ext_data['Average_PM10'] <= 500.4)]
        ext_data = ext_data[(ext_data['reference_data'] > 0)&(ext_data['reference_data'] <= 500.4)]
        ext_data = ext_data[(ext_data['temperature'] >= 0)&(ext_data ['temperature'] <= 30)]
        ext_data = ext_data[(ext_data['humidity'] >= 0)&(ext_data['humidity'] <= 100)]
        
        # ext_data['datetime'] = ext_data['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
        ext_data['datetime'] = pd.to_datetime(ext_data['datetime'])
        # ext_data.drop_duplicates(subset="datetime", keep='first', inplace=True)
        ext_data = ext_data.set_index('datetime')
        ext_data = ext_data.drop(['datetime'], axis=1)

        ext_data = ext_data.resample('H').mean().round(2)
        
        ext_data=ext_data[(ext_data['Average_PM2.5'].notnull())&(ext_data['Average_PM10'].notnull())&
                                                    (ext_data['reference_data'].notnull())].reset_index(drop=True)
                            
        ext_data.fillna(method='ffill',inplace = True)
 
        # extract hour feature
        ext_data['hour'] = ext_data['datetime'].dt.hour

        # Features from PM
        # 1)"error_pm2_5" the absolute value of the difference between the two sensor values for pm2_5.
        # 2)"error_pm10","check_symbol_pm10" same as 3 and 4 but for pm10.
        # 3)"pm2.5-pm10" the difference between "Average_PM2.5" and "Average_PM10" columns
        # 4)"pm2 5-pm10_%" ratio of "pm2.5-pm10" relative to "Average_PM10"

        ext_data["s2_pm2_5"]=np.where(ext_data["s2_pm2_5"]==0,ext_data["pm2_5"],ext_data["s2_pm2_5"])
        ext_data["s2_pm10"]=np.where(ext_data["s2_pm10"]==0,ext_data["pm10"],ext_data["s2_pm10"])
        ext_data["error_pm10"]=np.abs(ext_data["pm10"]-ext_data["s2_pm10"])
        ext_data["error_pm2_5"]=np.abs(ext_data["pm2_5"]-ext_data["s2_pm2_5"])
        ext_data["pm2_5_pm10"]=ext_data["Average_PM2.5"]-ext_data["Average_PM10"]
        ext_data["pm2_5_pm10_mod"]=ext_data["pm2_5_pm10"]/ext_data["Average_PM10"]

        combined_ext_data = ext_data[['Average_PM2.5','Average_PM10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod', 'reference_data']]
     
        model_pm2_5 = calibrate_tool.random_forest(combined_ext_data)
        model_pm10 = calibrate_tool.lasso_reg(combined_ext_data)

        return model_pm2_5, model_pm10
               
if __name__ == "__main__":
    calibrateInstance = Calibrate_tool()
