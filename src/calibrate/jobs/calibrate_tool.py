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

# RF_REG_MODEL = os.getenv('RF_REG_MODEL', 'jobs/rf_reg_model.pkl')
# LASSO_MODEL = os.getenv('LASSO_MODEL', 'jobs/lasso_model.pkl')

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


def get_and_clean_ext_data(ext_data):  
    # extract hour feature
    hourly_combined_dataset['hour'] = hourly_combined_dataset['Time'].dt.hour

    # Features from PM
    # 1)"error_pm2_5" the absolute value of the difference between the two sensor values for pm2_5.
    # 2)"error_pm10","check_symbol_pm10" same as 3 and 4 but for pm10.
    # 3)"pm2.5-pm10" the difference between "Average_PM2.5" and "Average_PM10" columns
    # 4)"pm2 5-pm10_%" ratio of "pm2.5-pm10" relative to "Average_PM10"

    hourly_combined_dataset["s2_pm2_5"]=np.where(hourly_combined_dataset["s2_pm2_5"]==0,hourly_combined_dataset["pm2_5"],hourly_combined_dataset["s2_pm2_5"])
    hourly_combined_dataset["s2_pm10"]=np.where(hourly_combined_dataset["s2_pm10"]==0,hourly_combined_dataset["pm10"],hourly_combined_dataset["s2_pm10"])
    hourly_combined_dataset["error_pm10"]=np.abs(hourly_combined_dataset["pm10"]-hourly_combined_dataset["s2_pm10"])
    hourly_combined_dataset["error_pm2_5"]=np.abs(hourly_combined_dataset["pm2_5"]-hourly_combined_dataset["s2_pm2_5"])
    hourly_combined_dataset["pm2_5_pm10"]=hourly_combined_dataset["avg_pm2_5"]-hourly_combined_dataset["avg_pm10"]
    hourly_combined_dataset["pm2_5_pm10_mod"]=hourly_combined_dataset["pm2_5_pm10"]/hourly_combined_dataset["avg_pm10"]

    # hourly_combined_dataset.to_csv('hourly_combined_dataset.csv')
    
    return hourly_combined_dataset

# def save_trained_model(trained_model,project_name,bucket_name,source_blob_name):
#     fs = gcsfs.GCSFileSystem(project=project_name)    
#     with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
#         job = joblib.dump(trained_model,handle)

def random_forest(hourly_combined_dataset):
    X= hourly_combined_dataset[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
    y = hourly_combined_dataset['bam_pm'].values    

    rf_regressor = RandomForestRegressor(random_state=42, max_features='sqrt', n_estimators= 1000, max_depth=50, bootstrap = True)
    # Fitting the model 
    rf_regressor = rf_regressor.fit(X, y) 
    # save the model to disk
    filename = RF_REG_MODEL
    pickle.dump(rf_regressor, open(filename, 'wb'))

    ##dump the model to google cloud storage.
    #save_trained_model(rf_regressor,'airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')

    
    return rf_regressor

def get_clean_data_PM10():
    sql = """
    SELECT 
        TimeStamp, AQ_G501_PM10,AQ_G501_PM2_5,AQ_G501_Sensor_I__PM10,AQ_G501_Sensor_II__PM10,
        AQ_G501_Sensor_I__PM2_5,AQ_G501_Sensor_II__PM2_5,MUK_BAM_Y24516__PM10,MUK_BAM_Y24516__AT_C,
        MUK_BAM_Y24516__RH
    FROM 
        `airqo-250220.thingspeak.collocation_data_PM10`
    GROUP BY 
        TimeStamp, AQ_G501_PM10,AQ_G501_PM2_5,AQ_G501_Sensor_I__PM10,AQ_G501_Sensor_II__PM10,
        AQ_G501_Sensor_I__PM2_5,AQ_G501_Sensor_II__PM2_5,MUK_BAM_Y24516__PM10,MUK_BAM_Y24516__AT_C,
        MUK_BAM_Y24516__RH
    ORDER BY 
        TimeStamp
        """
    dataset = client.query(sql).to_dataframe()

    # Remove outliers
    dataset  = dataset[(dataset['AQ_G501_PM10'] >= 0)&(dataset['AQ_G501_PM10'] <= 500.4)]
    dataset  = dataset[(dataset['AQ_G501_PM2_5'] >= 0)&(dataset['AQ_G501_PM2_5'] <= 500.4)]
    dataset  = dataset[(dataset['AQ_G501_Sensor_I__PM10'] >= 0)&(dataset['AQ_G501_Sensor_I__PM10'] <= 500.4)]
    dataset  = dataset[(dataset['AQ_G501_Sensor_II__PM10'] >= 0)&(dataset['AQ_G501_Sensor_II__PM10'] <= 500.4)]
    dataset  = dataset[(dataset['AQ_G501_Sensor_I__PM2_5'] >= 0)&(dataset['AQ_G501_Sensor_I__PM2_5'] <= 500.4)]
    dataset  = dataset[(dataset['AQ_G501_Sensor_II__PM2_5'] >= 0)&(dataset['AQ_G501_Sensor_II__PM2_5'] <= 500.4)]


    dataset  = dataset[(dataset['MUK_BAM_Y24516__PM10'] >= 0)&(dataset['MUK_BAM_Y24516__PM10'] <= 500.4)]
    dataset  = dataset[(dataset['MUK_BAM_Y24516__AT_C'] >= 0)&(dataset['MUK_BAM_Y24516__AT_C'] <=45)]
    dataset  = dataset[(dataset['MUK_BAM_Y24516__RH'] >= 0)&(dataset['MUK_BAM_Y24516__RH'] <= 99)]
    
    # BAM 1 hr ahead (SET to ENDING)
    dataset['MUK_BAM_Y24516__PM10']=dataset['MUK_BAM_Y24516__PM10'].shift(-1) 

    #fill na values
    dataset.fillna(method='ffill',inplace = True)
    dataset.fillna(method='bfill',inplace = True) 

    #FEATURES
    # extract hour
    dataset['hour'] =  dataset['TimeStamp'].dt.hour

    # 1)"Average_PM2.5" is the average of the value of pm2_5 from both sensors, the second sensor "Sensor2PM2.5_CF_1_ug/m3" values has some and it was removed and replaced with value of "pm2_5" for same datasetpoints.
    # 2)"Average_PM10" is the same as "Average_PM2.5" but for "pm_10"
    # 3)"error_pm2_5" the absolute value of the difference between the two sensor values for pm2_5.
    # 5)"error_pm10","check_symbol_pm10" same as 3 and 4 but for pm10.
    # 6)"pm2.5-pm10" the difference between "Average_PM2.5" and "Average_PM10" columns
    # 7)"pm2 5-pm10_%" ratio of "pm2.5-pm10" relative to "Average_PM10"

    dataset["AQ_G501_Sensor_II__PM2_5"]=np.where(dataset["AQ_G501_Sensor_II__PM2_5"]==0,dataset["AQ_G501_Sensor_I__PM2_5"],dataset["AQ_G501_Sensor_II__PM2_5"])
    dataset["AQ_G501_Sensor_II__PM10"]=np.where(dataset["AQ_G501_Sensor_II__PM10"]==0,dataset["AQ_G501_Sensor_I__PM10"],dataset["AQ_G501_Sensor_II__PM10"])
    dataset["error_pm10"]=np.abs(dataset["AQ_G501_Sensor_I__PM10"]-dataset["AQ_G501_Sensor_II__PM10"])
    dataset["error_pm2_5"]=np.abs(dataset["AQ_G501_Sensor_I__PM2_5"]-dataset["AQ_G501_Sensor_II__PM2_5"])
    dataset["pm2.5-pm10"]=dataset["AQ_G501_PM2_5"]-dataset["AQ_G501_PM10"]
    dataset["pm2 5-pm10_%"]=dataset["pm2.5-pm10"]/dataset["AQ_G501_PM10"]
    return  dataset

def lasso_reg(dataset):
    X = dataset[['AQ_G501_PM2_5','AQ_G501_PM10','MUK_BAM_Y24516__AT_C', 'MUK_BAM_Y24516__RH','hour','error_pm10', 'error_pm2_5', 'pm2.5-pm10', 'pm2 5-pm10_%']].values
    y = dataset['MUK_BAM_Y24516__PM10'].values  

   # Fitting the model 
    lasso_regressor = Lasso(random_state=0).fit(X, y)
    # save the model to disk
    filename = LASSO_MODEL
    pickle.dump(lasso_regressor, open(filename, 'wb'))

    ##dump the model to google cloud storage.
    #save_trained_model(rf_regressor,'airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')
    return lasso_regressor

if __name__ == "__main__":
    lowcost_hourly_mean = get_lowcost_data()
    bam_hourly_mean = get_bam_data()
    hourly_combined_dataset = combine_datasets(lowcost_hourly_mean, bam_hourly_mean)
    rf_regressor = random_forest(hourly_combined_dataset)
    dataset = get_clean_data_PM10()
    lasso_regressor = lasso_reg(dataset)
