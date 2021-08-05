import pandas as pd
import numpy as np
import os
import datetime
import google.auth
from google.cloud import bigquery


client = bigquery.Client.from_service_account_json("jobs/airqo-250220-5149c2aac8f2.json")


def get_lowcost_data():
    sql = """
    SELECT 
        created_at,pm2_5,s2_pm2_5,pm10,s2_pm10, SUM(pm2_5 + s2_pm2_5)/2 as avg_pm2_5, SUM(pm10 + s2_pm10)/2 as avg_pm10
    FROM 
        `airqo-250220.thingspeak.clean_feeds_pms`
    WHERE 
        channel_id = 967600
    AND 
        created_at >= '2020-07-15 00:00:00'
    AND 
        created_at <= '2021-03-23 23:59:59'
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
    AND 
        Time >= '2020-07-15 00:00:00'
    AND 
        Time <= '2021-03-23 23:59:59'
    GROUP BY 
        Time,ConcHR_ug_m3, AT_C, RH
    ORDER BY 
        Time
    """
    bam_data = client.query(sql).to_dataframe()
    bam_data = bam_data[(bam_data['bam_pm'] > 0)&(bam_data['bam_pm'] <= 500.4)]
                                       
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
    hourly_combined_dataset["error_pm2_5"]=hourly_combined_dataset["pm10"]-hourly_combined_dataset["s2_pm10"]
    hourly_combined_dataset["error_pm10"]=np.abs(hourly_combined_dataset["pm10"]-hourly_combined_dataset["s2_pm10"])
    hourly_combined_dataset["error_pm2_5"]=np.abs(hourly_combined_dataset["pm2_5"]-hourly_combined_dataset["s2_pm2_5"])
    hourly_combined_dataset["pm2_5_pm10"]=hourly_combined_dataset["avg_pm2_5"]-hourly_combined_dataset["avg_pm10"]
    hourly_combined_dataset["pm2_5_pm10_mod"]=hourly_combined_dataset["pm2_5_pm10"]/hourly_combined_dataset["avg_pm10"]

    # hourly_combined_dataset.to_csv('hourly_combined_dataset.csv')
    
    return hourly_combined_dataset




    