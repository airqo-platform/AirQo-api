from google.cloud import bigquery
import datetime as dt
from datetime import datetime,timedelta
import pandas as pd


def query_prediction_data():
    client = bigquery.Client()
    sql = """SELECT created_at ,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.clean_feeds_pms` """

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql,job_config=job_config).to_dataframe()
    df['created_at'] =  pd.to_datetime(df['created_at'])
    df['created_at'] = df['created_at'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('created_at')
    return time_indexed_data 

def save_predictions_all(predictions):
    client = bigquery.Client()
    dataset_ref = client.dataset('thingspeak','airqo-250220')
    table_ref = dataset_ref.table('model_predictions_experimentation')
    table = client.get_table(table_ref)

    rows_to_insert = predictions
    errors = client.insert_rows(table, rows_to_insert)
    if errors == []:
        return 'Records saved successfully.'
    else:
        return errors

def check_channel_id_exists(specified_channel_id) -> bool:
    '''
    gets channel with specified channnel Id.
    params: specified channel id.
    returns: True if record exists with specified channelId and the or False if record
    doesn't exist.
    '''
    client = bigquery.Client()

    query = """
        SELECT channel_id, latitude, longitude
        FROM `airqo-250220.thingspeak.channel`
        WHERE channel_id = {0} LIMIT 1
    """
    query = query.format(specified_channel_id)
   
    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config,
    )  
     
    results = query_job.result()
    if results.total_rows >=1:
        for row in results:
            channel = {"channel_id":row.channel_id,"latitude":row.latitude, "longitude":row.longitude}
        return True , channel          
    else:
        return False, {}


def save_weather_forecasts(weather_forecasts):
    client = bigquery.Client()
    dataset_ref = client.dataset('thingspeak','airqo-250220')
    table_ref = dataset_ref.table('met_office_weather_forecast')
    table = client.get_table(table_ref)

    rows_to_insert = weather_forecasts
    errors = client.insert_rows(table, rows_to_insert)
    if errors == []:
        return 'Records saved successfully.'
    else:
        return errors


def get_channel_data_raw(channel_id:int):
    channel_id = str(channel_id)
    client = bigquery.Client()
    sql_query = """
            SELECT created_at as time,channel_id,field1 as pm2_5
            FROM `airqo-250220.thingspeak.raw_feeds_pms` 
            WHERE channel_id = {0}
        """
    xx = "'"+ channel_id + "'"
    sql_query = sql_query.format(xx)

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql_query, job_config=job_config).to_dataframe()
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_convert('Africa/Kampala')
    df['pm2_5'] = pd.to_numeric(df['pm2_5'],errors='coerce')
    df['channel_id'] = pd.to_numeric(df['channel_id'],errors='coerce')
    time_indexed_data = df.set_index('time')
    return time_indexed_data 


def save_predictions(predictions):
    client = bigquery.Client()
    dataset_ref = client.dataset('thingspeak','airqo-250220')
    table_ref = dataset_ref.table('model_predictions')
    table = client.get_table(table_ref)

    rows_to_insert = predictions
    errors = client.insert_rows(table, rows_to_insert)
    if errors == []:
        return 'Records saved successfully.'
    else:
        return errors
      

def get_channel_best_configurations(channel_id:int):
    client = bigquery.Client()
    sql_query = """
            SELECT channel_id, number_of_days_to_use, considered_hours
            FROM `airqo-250220.thingspeak.model_configuration` 
            WHERE channel_id ={0} ORDER BY created_at DESC LIMIT 1
        """
    sql_query = sql_query.format(channel_id)

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(sql_query, job_config=job_config)
    results = query_job.result()
    best_model_configurations = []

    if results.total_rows >=1:
        for row in results:
            best_model_configurations.append({"channel_id":row.channel_id,
             "number_of_days_to_use":row.number_of_days_to_use, "considered_hours": row.considered_hours})
    return best_model_configurations

def save_configurations(best_model_configurations):
    client = bigquery.Client()
    dataset_ref = client.dataset('thingspeak','airqo-250220')
    table_ref = dataset_ref.table('model_configuration')
    table = client.get_table(table_ref)

    rows_to_insert = best_model_configurations
    errors = client.insert_rows(table, rows_to_insert)
    if errors == []:
        return 'Records saved successfully.'
    else:
        return errors
        #print('Error during inserting to BigQuery')
        #for i in errors:
            #print(errors[i])


def query_data():
    client = bigquery.Client()
    sql = """SELECT created_at as time,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.clean_feeds_pms` """

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql,job_config=job_config).to_dataframe()
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('time')
    return time_indexed_data    
    

def query_datax():
    client = bigquery.Client()
    sql = """SELECT created_at as time,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.clean_feeds_pms` 
        WHERE DATE(created_at) >= DATE_SUB(current_date, INTERVAL 2 MONTH)"""

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql,job_config=job_config).to_dataframe()
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('time')
    return time_indexed_data    

def get_channel_hourly_data(channel_id:int):
    client = bigquery.Client()
    sql_query = """
            SELECT  DATETIME_TRUNC(created_at, HOUR) time, channel_id, ROUND(AVG(pm2_5),2) AS avg_pm2_5
            FROM `airqo-250220.thingspeak.clean_feeds_pms` 
            WHERE channel_id = {0} GROUP BY channel_id, time ORDER BY time 
        """
    sql_query = sql_query.format(channel_id)

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql_query, job_config=job_config).to_dataframe()
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('time')
    return time_indexed_data 

def calculate_hourly_averages(df:pd.DataFrame):
    df.pm2_5 = pd.to_numeric(df['pm2_5'], errors='coerce')
    data_grp_hourly = df.groupby(['channel_id']).resample('H').mean().round(2)
    data_grp_hourly = data_grp_hourly.drop(['channel_id'], axis=1)
    hourly_data = data_grp_hourly.reset_index()
    return hourly_data 


def get_all_static_channels():
    client = bigquery.Client()

    query = """
        SELECT channel_id, latitude, longitude
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
            static_channels.append({"channel_id":row.channel_id,"latitude":row.latitude, "longitude":row.longitude})
    return static_channels

def get_all_channels_hourly_data():
    client = bigquery.Client()
    sql = """SELECT channel_id, DATETIME_TRUNC(created_at, HOUR) time, ROUND(AVG(pm2_5),2) AS pm2_5  
             FROM `airqo-250220.thingspeak.clean_feeds_pms` 
             GROUP BY channel_id, time ORDER BY channel_id, time"""

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql,job_config=job_config).to_dataframe()
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('time')
    return time_indexed_data	


def get_channel_data(channel_id:int):
    client = bigquery.Client()
    sql_query = """
            SELECT created_at as time,channel_id,pm2_5
            FROM `airqo-250220.thingspeak.clean_feeds_pms` 
            WHERE channel_id = {0}
        """
    sql_query = sql_query.format(channel_id)

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False
     
    df = client.query(sql_query, job_config=job_config).to_dataframe()
    df['time'] =  pd.to_datetime(df['time'])
    df['time'] = df['time'].dt.tz_localize('Africa/Kampala')
    time_indexed_data = df.set_index('time')
    return time_indexed_data    

def get_channel_id(latitude:str, longitude:str) -> int:
    lat= latitude
    lon = longitude

    channel_id = 0
    
    value1 = lat
    value2 = lon 
    client = bigquery.Client()

    query = """
        SELECT channel_id
        FROM `airqo-250220.thingspeak.channel`
        WHERE latitude = {0}
        AND longitude = {1}
        LIMIT 1
    """
    query = query.format(value1, value2)
   

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config,
    )  
     
    results = query_job.result()
    if results.total_rows >=1:
        for row in results:
            channel_id = row.channel_id
            #print(row.channel_id)
    else:
        channel_id =0

    return channel_id


def get_all_coordinates():
    client = bigquery.Client()

    query = """
        SELECT channel_id, latitude, longitude
        FROM `airqo-250220.thingspeak.channel`
        WHERE latitude != 0.0 OR longitude != 0.0
    """
    
    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config)

    results = query_job.result()
    coordinates = []

    if results.total_rows >=1:
        for row in results:
            coordinates.append({'channel_id':row.channel_id, 'latitude':row.latitude, 'longitude':row.longitude})
    return coordinates



if __name__ == '__main__':
 
    print('dm')
    #static_channels = get_all_static_channels()
    #print(static_channels)
    #df = query_data()
    #print(df)
    #data = calculate_hourly_averages(df)
    # print(data)
    # data.to_csv("dat.csv")
    #save_configurations()
    #best_config =  get_channel_best_configurations(870142)
    #print(best_config)