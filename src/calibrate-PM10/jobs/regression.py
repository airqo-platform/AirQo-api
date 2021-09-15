import pandas as pd
import numpy as np
import datetime
from google.cloud import bigquery
from sklearn.linear_model import Lasso, LassoCV
import pickle
import gcsfs
import joblib

client = bigquery.Client.from_service_account_json("jobs/airqo-250220-5149c2aac8f2.json")

def get_clean_data():
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

# def save_trained_model(trained_model,project_name,bucket_name,source_blob_name):
#     fs = gcsfs.GCSFileSystem(project=project_name)    
#     with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
#         job = joblib.dump(trained_model,handle)


def lasso_reg(dataset):
    X = dataset[['AQ_G501_PM2_5','AQ_G501_PM10','MUK_BAM_Y24516__AT_C', 'MUK_BAM_Y24516__RH','hour',  'error_pm10', 'error_pm2_5', 'pm2.5-pm10', 'pm2 5-pm10_%']].values
    y = dataset['MUK_BAM_Y24516__PM10'].values  

   # Fitting the model 
    lasso_regressor = LassoCV(cv=10, random_state=0).fit(X, y)
    # save the model to disk
    filename = 'jobs/lasso_model.pkl'
    pickle.dump(lasso_regressor, open(filename, 'wb'))

    ##dump the model to google cloud storage.
    #save_trained_model(rf_regressor,'airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')

    
    return lasso_regressor

if __name__ == "__main__":
    dataset = get_clean_data()
    lasso_regressor = lasso_reg(dataset)

    print(lasso_regressor)

    