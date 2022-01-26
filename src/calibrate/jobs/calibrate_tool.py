import pandas as pd
import numpy as np
import datetime
from google.cloud import bigquery
from sklearn.ensemble import RandomForestRegressor 
from sklearn.linear_model import Lasso
import pickle
import gcsfs
import joblib

import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
client = bigquery.Client.from_service_account_json(CREDENTIALS)

RF_REG_MODEL = os.getenv('RF_REG_MODEL', 'jobs/rf_reg_model.pkl')
LASSO_MODEL = os.getenv('LASSO_MODEL', 'jobs/lasso_model.pkl')

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

    return combined_ext_data

# def save_trained_model(trained_model,project_name,bucket_name,source_blob_name):
#     fs = gcsfs.GCSFileSystem(project=project_name)    
#     with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
#         job = joblib.dump(trained_model,handle)

def random_forest(combined_ext_data):
    X= combined_ext_data[['Average_PM2.5','Average_PM10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
    y = combined_ext_data['reference_data'].values    

    rf_regressor = RandomForestRegressor(random_state=42, max_features='sqrt', n_estimators= 1000, max_depth=50, bootstrap = True)
    # Fitting the model 
    rf_regressor = rf_regressor.fit(X, y) 
    # save the model to disk
    filename = RF_REG_MODEL
    pickle.dump(rf_regressor, open(filename, 'wb'))

    ##dump the model to google cloud storage.
    #save_trained_model(rf_regressor,'airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')

    
    return rf_regressor

def lasso_reg(combined_ext_data):
    X= combined_ext_data[['Average_PM2.5','Average_PM10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
    y = combined_ext_data['reference_data'].values   

   # Fitting the model 
    lasso_regressor = Lasso(random_state=0).fit(X, y)
    # save the model to disk
    filename = LASSO_MODEL
    pickle.dump(lasso_regressor, open(filename, 'wb'))

    ##dump the model to google cloud storage.
    #save_trained_model(rf_regressor,'airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')
    return lasso_regressor

if __name__ == "__main__":
    ext_data = get_and_clean_ext_data(pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime, reference_data)
    combined_ext_data = extract_features(ext_data)
    rf_regressor = random_forest(combined_ext_data)
    lasso_regressor = lasso_reg(combined_ext_data)
