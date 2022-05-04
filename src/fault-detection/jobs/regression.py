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

def get_lowcost_data():
    sql = """
    SELECT 
        created_at,pm2_5,s2_pm2_5,pm10,s2_pm10, SUM(pm2_5 + s2_pm2_5)/2 as avg_pm2_5, SUM(pm10 + s2_pm10)/2 as avg_pm10
    FROM 
        `airqo-250220.thingspeak.clean_feeds_pms`
    WHERE 
        channel_id = 967600
    GROUP BY 
        created_at,pm2_5,s2_pm2_5,pm10,s2_pm10
    ORDER BY 
        created_at
        """
    lowcost_data = client.query(sql).to_dataframe()
    lowcost_data = lowcost_data[(lowcost_data['avg_pm2_5'] > 0)&(lowcost_data['avg_pm2_5'] <= 500.4)]
    lowcost_data = lowcost_data[(lowcost_data['avg_pm10'] > 0)&(lowcost_data['avg_pm10'] <= 500.4)]
                                       
    lowcost_data["TimeStamp"] = pd.to_datetime(lowcost_data["created_at"])
    lowcost_data["TimeStamp"] = lowcost_data["TimeStamp"]+datetime.timedelta(hours=3)
    lowcost_data.drop_duplicates(subset="TimeStamp", keep='first', inplace=True)
    lowcost_data = lowcost_data.set_index('TimeStamp')
    lowcost_data = lowcost_data.drop(['created_at'], axis=1)
    
    lowcost_hourly_mean = lowcost_data.resample('H').mean().round(2)                          
    return  lowcost_hourly_mean

def get_bam_data():
    sql = """
    SELECT 
        Time,
        ConcHR_ug_m3 as bam_pm,
        AT_C as temperature, 
        RH as humidity
    FROM 
        `airqo-250220.thingspeak.airqo_bam_data`
    WHERE 
        channel_id = -24516
    GROUP BY 
        Time,ConcHR_ug_m3, AT_C, RH
    ORDER BY 
        Time
    """
    bam_data = client.query(sql).to_dataframe()
    bam_data = bam_data[(bam_data['bam_pm'] > 0)&(bam_data['bam_pm'] <= 500.4)]
    bam_data  = bam_data[(bam_data['temperature'] >= 0)&(bam_data ['temperature'] <= 30)]
    bam_data  = bam_data[(bam_data['humidity'] >= 0)&(bam_data['humidity'] <= 100)]
                                       
    bam_data["TimeStamp"] = pd.to_datetime(bam_data["Time"])
    bam_data.drop_duplicates(subset="TimeStamp", keep='first', inplace=True)
    bam_data = bam_data.set_index('TimeStamp')
    bam_data = bam_data.drop(['Time'], axis=1)
    # some data with sampling rate not equal to hourly
    bam_hourly_mean = bam_data.resample('H').mean().round(2) 
                              
    return  bam_hourly_mean

def combine_datasets(lowcost_hourly_mean, bam_hourly_mean):
    lowcost_hourly_timestamp = lowcost_hourly_mean.index.values
    lowcost_hourly_mean["Time"] = lowcost_hourly_timestamp

    bam_hourly_timestamp = bam_hourly_mean.index.values
    bam_hourly_mean["Time"] = bam_hourly_timestamp

    hourly_combined_dataset = pd.merge(lowcost_hourly_mean, bam_hourly_mean, on='Time')
    hourly_combined_dataset=hourly_combined_dataset[(hourly_combined_dataset['avg_pm2_5'].notnull())&
                                              (hourly_combined_dataset['avg_pm10'].notnull())&
                                              (hourly_combined_dataset['bam_pm'].notnull())].reset_index(drop=True)
    # BAM timestamp set to ENDING for this period (July to Mar)
    hourly_combined_dataset['bam_pm']=hourly_combined_dataset['bam_pm'].shift(-1)
    #Fill null values
    hourly_combined_dataset.fillna(method='ffill',inplace = True)
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
