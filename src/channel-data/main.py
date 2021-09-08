import json,requests
import datetime as dt
from datetime import datetime,timedelta
from google.cloud import storage
from google.cloud import bigquery
import base64
import ndjson
import logging
import os
from dotenv import load_dotenv
from config import configuration
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

storage_client = storage.Client()
bigquery_client = bigquery.Client()

#function to get channel ids and api keys from cloud storage
def load_creds():
    blob = storage_client.get_bucket('api-keys-bucket') \
        .get_blob('api-keys.json') \
        .download_as_string()
        
    parsed = json.loads(blob)
    return parsed


#function to get entry id and timestamp of last entry in json file
def get_last(channel_id):
    read_storage_client = storage.Client()
    bucket_name = 'airqo-bucket'
    filename = 'channel%s.json'%channel_id
    
    bucket = read_storage_client.get_bucket(bucket_name)
    stats = storage.Blob(bucket=bucket, name=filename).exists(storage_client)
    #size= storage.get_blob(bucket=bucket, name=filename).chunksize
    if not stats:
        last_id = 0
        last_time = None
    else:
        blob = bucket.get_blob(filename)
        json_data_string = blob.download_as_string()
        json_data=ndjson.loads(json_data_string)
        json_list = []
        for item in json_data:
            json_list.append(item)
          
        if len(json_list) != 0:
            last_id = json_list[-1]['entry_id']
            last_time = str_to_date(json_list[-1]['created_at'])
        else:
            last_id= None
            last_time=None
    
    return last_id,last_time

def fetch_and_write_new():
    try: 
        # action = base64.b64decode(data['data']).decode('utf-8') # retrieve pubsub message# ...
    
        # if (action == "download!"): # work is conditional on message content
        creds = load_creds()
        for i in range(len(creds)):
            print(creds[i]['channel_id'])
            payload = download_new(creds[i]['channel_id'], creds[i]['api_key']) 
            if len(payload)==0:
                pass
            else:
                for j in range(len(payload)):
                    payload[j]['channel_id'] = creds[i]['channel_id']
                    if 'field8' not in payload[j]:
                        payload[j]['field8'] = None
                payload = '\n'.join(json.dumps(item) for item in payload) # transform to ND json
                
                file_name = 'channel%s.json' %creds[i]['channel_id']
                if os.getenv("ENV") == "production":
                    bucket = storage_client.get_bucket('airqo-bucket')
                    blob = bucket.blob(file_name)
                    blob.upload_from_string(payload)
                
                file_path = 'gs://airqo-bucket/%s'%file_name
                insert_data_bqtable(file_path, configuration.BQ_SCHEME, configuration.RAW_FEEDS_PMS)
                
                if os.getenv("ENV") == "production":
                    insert_data_bqtable(file_path,configuration.BQ_SCHEME, configuration.RAW_FEEDS_PMS_CLUSTERED)
                    # insert_data_bqtable(file_path,'thingspeak','new_data_pms')
                    insert_data_bqtable(file_path,configuration.BQ_SCHEME, configuration.DATAPREP_TABLE)
        return 'Update Complete'
    except Exception as e:
        logging.exception('Could not ....')
        logging.exception(e)
        logging.exception(i)
        #logger.error(f"Trace: {traceback.format_exc()}")
        #time.sleep(5)
        #raise e

        
#function to transfer data from cloud storage to bigquery table
def insert_data_bqtable(target_uri, dataset_id, table_id):
    dataset_ref = bigquery_client.dataset(dataset_id)
    job_config = bigquery.LoadJobConfig()
    
    #job_config.autodetect = True
    job_config.write_disposition = 'WRITE_APPEND'
    job_config.source_format = 'NEWLINE_DELIMITED_JSON'
    #job_config.schema
    
    uri = target_uri
    
    load_job = bigquery_client.load_table_from_uri(uri,
                                                   dataset_ref.table(table_id),
                                                   job_config=job_config)
    #print('Starting job {}'.format(load_job.job_id))
    load_job.result()  # Waits for table load to complete.
    return 'Job finished.'

#function to donload new data from ThingSpeak
def download_new(channel_id, api_key):
    url='https://thingspeak.com/channels/'
    new_channel_data = []
    result = None    
    last_id, last_time = get_last(channel_id)
    if not last_id and not last_time:
        new_channel_data = []
    else:
        next_id = last_id+1
        endtime = last_time+timedelta(seconds=1)
    
        while result!=-1:
            channel_url = url+channel_id+'/feeds/entry/%d.json?api_key=%s' %(next_id, api_key)
            result = json.loads(requests.get(channel_url, timeout = 100.0).content.decode('utf-8'))
            starttime=endtime
    
            if result==-1:
                endtime = datetime.now()
            else:
                endtime = str_to_date(result['created_at'])
            if next_id == 1:
                starttime = endtime
            else:
                start = datetime.strftime(starttime,'%Y-%m-%dT%H:%M:%SZ')
                end = datetime.strftime(endtime-timedelta(seconds=1),'%Y-%m-%dT%H:%M:%SZ')
                channel_url = url+channel_id+'/feeds.json?start=%s&end=%s&api_key=%s' %(start,end,api_key) 
                data = json.loads(requests.get(channel_url, timeout = 100.0).content.decode('utf-8'))
                if (data!=-1) and ('feeds' in data): #edited this, it only had the first condition
                    new_channel_data.extend(data['feeds'])
                else:
                    print("Unable to read data feed")
                    print(data)

            next_id += 7999
    return new_channel_data

def str_to_date(st):
    return datetime.strptime(st,'%Y-%m-%dT%H:%M:%SZ')

if __name__ == '__main__':
    fetch_and_write_new()