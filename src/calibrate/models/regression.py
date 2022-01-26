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
    # def __init__(self):
    #     """ initialize """
    #     lowcost_hourly_mean = gd.get_lowcost_data()
    #     bam_hourly_mean = gd.get_bam_data()
    #     self.hourly_combined_dataset = gd.combine_datasets(lowcost_hourly_mean, bam_hourly_mean)

    # def get_model(self, project_name,bucket_name,source_blob_name):
    #     fs = gcsfs.GCSFileSystem(project=project_name)
    #     fs.ls(bucket_name)
    #     with fs.open(bucket_name + '/' + source_blob_name, 'rb') as handle:
    #         job = joblib.load(handle)
    #     return job
  
    def compute_calibrated_val(self,pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity,datetime):  
        # features from datetime and PM
        datetime = pd.to_datetime(datetime)
        hour = datetime.hour
        input_variables = pd.DataFrame([[pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity,hour]],
                                    columns=['pm2_5','s2_pm2_5','pm10','s2_pm10','temperature','humidity','hour'],
                                    dtype='float',
                                    index=['input'])
        input_variables["avg_pm2_5"] = input_variables[['pm2_5','s2_pm2_5']].mean(axis=1).round(2)
        input_variables["avg_pm10"] =  input_variables[['pm10','s2_pm10']].mean(axis=1).round(2)
        input_variables["error_pm10"]=np.abs(input_variables["pm10"]-input_variables["s2_pm10"])
        input_variables["error_pm2_5"]=np.abs(input_variables["pm2_5"]-input_variables["s2_pm2_5"])
        input_variables["pm2_5_pm10"]=input_variables["avg_pm2_5"]-input_variables["avg_pm10"]
        input_variables["pm2_5_pm10_mod"]=input_variables["pm2_5_pm10"]/input_variables["avg_pm10"]
        input_variables = input_variables.drop(['pm2_5','s2_pm2_5','pm10','s2_pm10'], axis=1)
        
        #reorganise columns
        input_variables = input_variables[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']]

        #load model from disk
        rf_regressor = pickle.load(open(RF_REG_MODEL, 'rb'))
        lasso_regressor = pickle.load(open(LASSO_MODEL, 'rb'))
        # # load model from GCP 
        # rf_regressor = self.get_model('airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')
        calibrated_pm2_5 =  rf_regressor.predict(input_variables)[0]
        calibrated_pm10 =  lasso_regressor.predict(input_variables)[0]  
        
        return calibrated_pm2_5, calibrated_pm10


    def get_and_clean_ext_data(pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime, reference_data):
        datetime = pd.to_datetime(datetime)
        ext_data = pd.DataFrame([[pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity,datetime,reference_data]],
                                        columns=['pm2_5','s2_pm2_5','pm10','s2_pm10','temperature','humidity','hour', 'datetime','reference_data'],
                                        dtype='float',
                                        index=['input'])
        # filter outliers
        ext_data = ext_data[(ext_data['avg_pm2_5'] > 0)&(ext_data['avg_pm2_5'] <= 500.4)]
        ext_data = ext_data[(ext_data['avg_pm10'] > 0)&(ext_data['avg_pm10'] <= 500.4)]
        ext_data = ext_data[(ext_data['reference_data'] > 0)&(ext_data['reference_data'] <= 500.4)]
        ext_data = ext_data[(ext_data['temperature'] >= 0)&(ext_data ['temperature'] <= 30)]
        ext_data = ext_data[(ext_data['humidity'] >= 0)&(ext_data['humidity'] <= 100)]
        
        ext_data.drop_duplicates(subset="datetime", keep='first', inplace=True)
        ext_data = ext_data.set_index('datetime')
        ext_data = ext_data.drop(['datetime'], axis=1)

        ext_data = ext_data.resample('H').mean().round(2)

        ext_data['Average_PM2.5'] = ext_data[['pm2_5', 's2_pm2_5']].mean(axis=1).round(2)
        ext_data['Average_PM10'] = ext_data[['pm10', 's2_pm10']].mean(axis=1).round(2)
        
        ext_data=ext_data[(ext_data['Average_PM2.5'].notnull())&(ext_data['Average_PM10'].notnull())&
                                                    (ext_data['reference_data'].notnull())].reset_index(drop=True)
                            
        ext_data.fillna(method='ffill',inplace = True)
        return  ext_data

    def extract_features(ext_data):  
        # extract hour feature
        ext_data['hour'] = ext_data['Time'].dt.hour

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

        combined_ext_data = ext_data

        return combined_ext_data
               
    
if __name__ == "__main__":
    calibrateInstance = Regression()
