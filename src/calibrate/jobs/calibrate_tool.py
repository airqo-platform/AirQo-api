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
