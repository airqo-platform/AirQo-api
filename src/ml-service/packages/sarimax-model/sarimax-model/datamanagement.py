from google.cloud import bigquery
import datetime as dt
from datetime import datetime,timedelta
import pandas as pd


def calculate_hourly_averages(df:pd.DataFrame):
    df.pm2_5 = pd.to_numeric(df['pm2_5'], errors='coerce')
    data_grp_hourly = df.groupby(['channel_id']).resample('H').mean().round(2)
    data_grp_hourly = data_grp_hourly.drop(['channel_id'], axis=1)
    hourly_data = data_grp_hourly.reset_index()
    return hourly_data 



def get_all_static_channels():
    client = bigquery.Client()

    query = """
        SELECT channel_id
        FROM `airqo-250220.thingspeak.channel`
        WHERE latitude != 0.0 OR longitude != 0.0
    """
    
    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config)

    results = query_job.result()
    static_channels = []

    if results.total_rows >=1:
        for row in results:
            static_channels.append(row.channel_id)
    return static_channels

def query_data():
    client = bigquery.Client()
    sql = """SELECT created_at as time,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.clean_feeds_pms` 
        WHERE DATE(created_at) >= DATE_SUB(current_date, INTERVAL 1 MONTH)"""
     
    df = client.query(sql).to_dataframe()
    #df.set_index('created_at',inplace=True)
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('time')
    #print(type(df))
    #print(type(time_indexed_data))
    return time_indexed_data	
#print(query_data())




if __name__ == '__main__':
    #static_channels = get_all_static_channels()
    #print(static_channels)
    df = query_data()
    print(df)
    data = calculate_hourly_averages(df)
    print(data)
    data.to_csv("dat.csv")