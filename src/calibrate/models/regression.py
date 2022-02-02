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

PM2_5_TOOL = os.getenv('PM2_5_TOOL', 'jobs/pmflaks2_5_tool.pkl')
PM10_TOOL = os.getenv('PM10_TOOL', 'jobs/pm10_tool.pkl')

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
        
        input_variables = input_variables[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']]

        #load model from disk
        rf_regressor = pickle.load(open(PM2_5_TOOL, 'rb'))
        lasso_regressor = pickle.load(open(PM10_TOOL, 'rb'))
        # # load model from GCP 
        # rf_regressor = self.get_model('airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')
        calibrated_pm2_5 =  rf_regressor.predict(input_variables)[0]
        calibrated_pm10 =  lasso_regressor.predict(input_variables)[0]  
        
        return calibrated_pm2_5, calibrated_pm10
               
if __name__ == "__main__":
    calibrateInstance = Regression()
