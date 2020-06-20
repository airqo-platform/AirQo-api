import app
from datetime import datetime, timedelta
from helpers import db_helpers, utils
import requests
import math
from google.cloud import bigquery
import pandas as pd

class DeviceStatus():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self):
        """ initialize """

    # get device status infromation
    def get_device_status(self):
        db = db_helpers.connect_mongo()
        documents = db.device_status_summary.find({})
        return documents


    def get_all_devices_latest_status(self):
        """
        Gets the latest status of whether device was online or offline in the last two hours. 

        Args:
        Returns:
            A list of the records containing the status of devices interms of percentage, 
            the count of devices that were offline and online and the devices info.
        """       
        created_at = utils.str_to_date(utils.date_to_str(datetime.now().replace(microsecond=0, second=0, minute=0)-timedelta(hours=4)))
        #print(created_at) 
        time_format = '%Y-%m-%dT%H:%M:%S%z'      
        query = {'$match':{ 'created_at': {'$gte': created_at} }}
        projection = { '$project': { '_id': 0, 'created_at': {'$dateToString':{ 'format': time_format, 'date': '$time', 'timezone':'Africa/Kampala'}}, }}
        sort_order= { '$sort' : { '_id' : -1  }}
        limit = {'$limit': 1}
        db = db_helpers.connect_mongo()
        #results = db.device_status_hourly_check_results.find().sort([('_id',-1)]).limit(1)
        results = db.device_status_hourly_check_results.find({},{ '_id': 0}).sort([('$natural',-1)]).limit(1)
        #results = list(db.device_status_hourly_check_results.aggregate([query, projection,sort_order,limit]) )       
        return results
        
    


    def get_all_devices(self):
        db = db_helpers.connect_mongo()
        results = list(db.device_status_summary.find({},{'_id':0}))
        return results

            
    def str_to_date_find(self,st):
        """
        Converts a string of different format to datetime
        """
        return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')

    def get_raw_channel_data(self, channel_id:int):
        channel_id = str(channel_id)
        client = bigquery.Client()
        sql_query = """ 
            
                SELECT SAFE_CAST(TIMESTAMP(created_at) as DATETIME) as time, channel_id,field1 as s1_pm2_5,
                field2 as s1_pm10, field3 as s2_pm2_5, field4 s2_pm10, 
                FROM `airqo-250220.thingspeak.raw_feeds_pms` 
                WHERE channel_id = {0}  
            """  
        xx = "'"+ channel_id + "'"
        sql_query = sql_query.format(xx)

        job_config = bigquery.QueryJobConfig()
        job_config.use_legacy_sql = False
        
        df = client.query(sql_query, job_config=job_config).to_dataframe()
        df['time'] =  pd.to_datetime(df['time'])
        df['time'] = df['time']
        df['s1_pm2_5'] = pd.to_numeric(df['s1_pm2_5'],errors='coerce')
        df['channel_id'] = pd.to_numeric(df['channel_id'],errors='coerce')
        df['s1_pm10'] = pd.to_numeric(df['s1_pm10'],errors='coerce')
        df['s2_pm2_5'] = pd.to_numeric(df['s2_pm2_5'],errors='coerce')
        df['s2_pm10'] = pd.to_numeric(df['s2_pm10'],errors='coerce')
        df['s1_s2_average_pm2_5'] = df[['s1_pm2_5', 's2_pm2_5']].mean(axis=1).round(2)
        df['s1_s2_average_pm10'] = df[['s1_pm10', 's2_pm10']].mean(axis=1).round(2)
        time_indexed_data = df.set_index('time')
        final_hourly_data = time_indexed_data.resample('H').mean().round(2) 
        final_data=final_hourly_data.dropna().reset_index()
        
        return final_data

if __name__ == "__main__":
    dx = DeviceStatus()
    
