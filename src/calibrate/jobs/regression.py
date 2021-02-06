import pandas as pd
import numpy as np
import os
import datetime
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn import metrics
import scipy.stats
import joblib
from scipy.optimize import curve_fit
import uncertainties.unumpy as unp
import uncertainties as unc
import google.auth
from google.cloud import bigquery


client = bigquery.Client.from_service_account_json("jobs/airqo-250220-5149c2aac8f2.json")


def get_lowcost_data():
    sql = """
    SELECT 
        created_at, SUM(pm2_5 + s2_pm2_5)/2 as lowcost_pm
    FROM 
        `airqo-250220.thingspeak.clean_feeds_pms`
    WHERE 
        channel_id = 967600
    AND
        created_at >="2020-07-15T21:00:00"
    AND 
        created_at <="2020-07-30T20:59:59"
    GROUP BY 
        created_at
    ORDER BY 
        created_at
        """
    lowcost_data = client.query(sql).to_dataframe()
    lowcost_data = lowcost_data[(lowcost_data['lowcost_pm'] > 0)&(lowcost_data['lowcost_pm'] <= 500.4)]
                                       
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
        ConcHR_ug_m3_ as bam_pm,
        AT_C_ as temperature, 
        RH___ as humidity
    FROM 
        `airqo-250220.thingspeak.airqo_bam_data`
    WHERE 
        channel_id = 'Y24516'
    AND
        Time >="2020-07-16T00:00:00"
    AND 
        Time <="2020-07-30T23:59:59"
    GROUP BY 
        Time,ConcHR_ug_m3_,AT_C_, RH___ 
    ORDER BY 
        Time
    """
    bam_data = client.query(sql).to_dataframe()
    bam_data = bam_data[(bam_data['bam_pm'] > 0)&(bam_data['bam_pm'] <= 500.4)]
                                       
    bam_data["TimeStamp"] = pd.to_datetime(bam_data["Time"])
    bam_data.drop_duplicates(subset="TimeStamp", keep='first', inplace=True)
    bam_data = bam_data.set_index('TimeStamp')
    bam_data = bam_data.drop(['Time'], axis=1)
    
    bam_hourly_mean = bam_data                        
    return  bam_hourly_mean

def combine_datasets(lowcost_hourly_mean, bam_hourly_mean):
    lowcost_hourly_timestamp = lowcost_hourly_mean.index.values
    lowcost_hourly_mean["Time"] = lowcost_hourly_timestamp

    bam_hourly_timestamp = bam_hourly_mean.index.values
    bam_hourly_mean["Time"] = bam_hourly_timestamp

    hourly_combined_dataset = pd.merge(lowcost_hourly_mean, bam_hourly_mean, on='Time')
    hourly_combined_dataset = hourly_combined_dataset[hourly_combined_dataset['lowcost_pm'].notna()]
    hourly_combined_dataset = hourly_combined_dataset[hourly_combined_dataset['bam_pm'].notna()]
    return hourly_combined_dataset

def simple_linear_regression(hourly_combined_dataset):

    X_muk = hourly_combined_dataset['lowcost_pm'].values
    X_muk = X_muk.reshape((-1, 1))
    y_muk = hourly_combined_dataset['bam_pm'].values

    X_train_muk, X_test_muk, y_train_muk, y_test_muk = train_test_split(
        X_muk, y_muk, test_size=0.2, random_state=0)

    regressor_muk = LinearRegression()
    regressor_muk.fit(X_train_muk, y_train_muk)

    intercept = regressor_muk.intercept_
    slope = regressor_muk.coef_
    RMSE =  np.sqrt(metrics.mean_squared_error(y_test_muk, y_pred_muk))

    return regressor_muk


def mlr(hourly_combined_dataset):
    X_MLRx = hourly_combined_dataset[['lowcost_pm','temperature','humidity']]
    X_MLR_muk = hourly_combined_dataset[['lowcost_pm','temperature','humidity']].values
    y_MLR_muk = hourly_combined_dataset['bam_pm'].values    

    X_train_MLR_muk, X_test_MLR_muk, y_train_MLR_muk, y_test_MLR_muk = train_test_split(X_MLR_muk, y_MLR_muk, test_size=0.2, random_state=0)
    regressor_MLR_muk = LinearRegression()  
    regressor_MLR_muk.fit(X_train_MLR_muk, y_train_MLR_muk)

    intercept_df_muk = regressor_MLR_muk.intercept_
    coeff_df_muk = regressor_MLR_muk.coef_
    RMSE = np.sqrt(metrics.mean_squared_error(y_test_MLR_muk, y_pred_mlr_muk))    

    return regressor_MLR_muk
