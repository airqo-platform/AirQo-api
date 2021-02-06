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


client = bigquery.Client.from_service_account_json("airqo-250220-5149c2aac8f2.json")


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

lowcost_hourly_mean = get_lowcost_data()


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

bam_hourly_mean = get_bam_data()


def combine_datasets(lowcost_hourly_mean, bam_hourly_mean):
    lowcost_hourly_timestamp = lowcost_hourly_mean.index.values
    lowcost_hourly_mean["Time"] = lowcost_hourly_timestamp
    #lowcost_hourly_mean["Time"] = pd.to_datetime(lowcost_hourly_mean["Time"])

    bam_hourly_timestamp = bam_hourly_mean.index.values
    bam_hourly_mean["Time"] = bam_hourly_timestamp
    #bam_hourly_mean["Time"] = pd.to_datetime(lowcost_hourly_mean["Time"])

    hourly_combined_dataset = pd.merge(lowcost_hourly_mean, bam_hourly_mean, on='Time')
    #hourly_combined_dataset['bam_pm'] = hourly_combined_dataset['lowcost_pm'].shift(-1)
    hourly_combined_dataset = hourly_combined_dataset[hourly_combined_dataset['lowcost_pm'].notna()]
    hourly_combined_dataset = hourly_combined_dataset[hourly_combined_dataset['bam_pm'].notna()]
    return hourly_combined_dataset

hourly_combined_dataset = combine_datasets(lowcost_hourly_mean, bam_hourly_mean)



def linear_regression_func(hourly_combined_dataset):
    # take only rows where hourly_PM is not null

    X_muk = hourly_combined_dataset['muk_lowcost_hourly_PM'].values
    X_muk = X_muk.reshape((-1, 1))
    y_muk = hourly_combined_dataset['muk_bam_hourly_PM'].values

    X_train_muk, X_test_muk, y_train_muk, y_test_muk = train_test_split(
        X_muk, y_muk, test_size=0.2, random_state=0)

    regressor_muk = LinearRegression()
    regressor_muk.fit(X_train_muk, y_train_muk)

    intercept = regressor_muk.intercept_

    slope = regressor_muk.coef_

    return regressor_muk


regressor_muk = linear_regression_func(hourly_combined_dataset)


def intercept(regressor_muk):
    intercept = regressor_muk.intercept_
    return intercept


intercept = intercept(regressor_muk)
# print(intercept)


def slope(regressor_muk):
    slope = regressor_muk.coef_
    return slope


slope = slope(regressor_muk)
# print(slope)



