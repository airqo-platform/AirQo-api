import pandas as pd
import numpy as np
import datetime
from google.cloud import bigquery
from sklearn.ensemble import RandomForestRegressor 
from sklearn.linear_model import Lasso
import pickle
import joblib

import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
client = bigquery.Client.from_service_account_json(CREDENTIALS)

RF_MODEL_MIN = os.getenv('RF_MODEL_MIN', 'jobs/rf_model_min.pkl')

def get_lowcost_data():
    sql = """
    SELECT 
        created_at, SUM(pm2_5 + s2_pm2_5)/2 as avg_pm2_5
    FROM 
        `airqo-250220.thingspeak.clean_feeds_pms`
    WHERE 
        channel_id = 967600
    GROUP BY 
        created_at
    ORDER BY 
        created_at
        """
    lowcost_data = client.query(sql).to_dataframe()
    lowcost_data = lowcost_data[(lowcost_data['avg_pm2_5'] > 0)&(lowcost_data['avg_pm2_5'] <= 500.4)]
                                       
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
                                              (hourly_combined_dataset['bam_pm'].notnull())].reset_index(drop=True)
    # BAM timestamp set to ENDING for this period (July to Mar)
    hourly_combined_dataset['bam_pm']=hourly_combined_dataset['bam_pm'].shift(-1)
    #Fill null values
    hourly_combined_dataset.fillna(method='ffill',inplace = True)
    
    return hourly_combined_dataset

def random_forest(hourly_combined_dataset):
    X= hourly_combined_dataset[['avg_pm2_5','temperature','humidity']].values
    y = hourly_combined_dataset['bam_pm'].values    

    rf_regressor = RandomForestRegressor(random_state=42, max_features='sqrt', n_estimators= 1000, max_depth=50, bootstrap = True)
    # Fitting the model 
    rf_regressor = rf_regressor.fit(X, y) 
    # save the model to disk
    filename = RF_MODEL_MIN
    pickle.dump(rf_regressor, open(filename, 'wb'))

    return rf_regressor

if __name__ == "__main__":
    lowcost_hourly_mean = get_lowcost_data()
    bam_hourly_mean = get_bam_data()
    hourly_combined_dataset = combine_datasets(lowcost_hourly_mean, bam_hourly_mean)
    rf_regressor = random_forest(hourly_combined_dataset)
