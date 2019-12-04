from google.cloud import bigquery
import datetime as dt
from datetime import datetime,timedelta
import pandas as pd
def query_data():
    client = bigquery.Client()
    sql = """SELECT created_at,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.feeds2_pms` LIMIT 1000"""
    df = client.query(sql).to_dataframe()
    #df.set_index('created_at',inplace=True)
    df["created_at"] =  pd.to_datetime(df["created_at"])
    df['created_at'] = df['created_at'].dt.tz_localize('Africa/Kampala')
    df.set_index('created_at',inplace=True)
    time_indexed_data = df.index
    #airqo_hourly_airquality_data_concentrations_mean  = time_indexed_data.resample('H').mean().round(2)
    #show_dataframe_info(airqo_hourly_airquality_data_concentrations_mean)
    return df
#print(query_data())
