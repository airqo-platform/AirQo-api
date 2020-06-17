import base64
import datetime as dt
from bson import json_util, ObjectId
import json
from datetime import datetime,timedelta
from pymongo import MongoClient
import requests
import math

MONGO_URI = "mongodb://admin:airqo-250220-master@35.224.67.244:27017"

client = MongoClient(MONGO_URI)
db=client['airqo_devicemonitor']

def function_to_execute(event, context):
    """Triggered from a message on a Cloud Pub/Sub topic.
    Args:
         event (dict): Event payload.
         context (google.cloud.functions.Context): Metadata for the event.
    """
    action = base64.b64decode(event['data']).decode('utf-8')

    if (action == "check_device_status"):
        get_device_channel_status()
         

def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')

def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date,'%Y-%m-%dT%H:%M:%S.%fZ')
    
def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')

def date_to_formated_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date,'%Y-%m-%d %H:%M')

def get_all_devices():
    results = db.device_status_summary.find({},{'_id':0})
    return results

def get_device_channel_status():
        BASE_API_URL='https://data-manager-dot-airqo-250220.appspot.com/api/v1/data/'
        #https://data-manager-dot-airqo-250220.appspot.com/api/v1/data/channels
        #https://data-manager-dot-airqo-250220.appspot.com/api/v1/data/feeds/recent/672528
        api_url = '{0}{1}'.format(BASE_API_URL,'channels')
        print(api_url)
        response = requests.get(api_url)  
        results = response.json()
        count =0
        count_of_online_devices =0
        online_devices=[]
        offline_devices=[]
        count_of_offline_devices =0
        for channel in results:
            print(channel['id'])
            latest_device_status_request_api_url = '{0}{1}{2}'.format(BASE_API_URL,'feeds/recent/', channel['id'] )
            latest_device_status_response = requests.get(latest_device_status_request_api_url)
            if latest_device_status_response.status_code == 200:
                print(latest_device_status_response.json())
                result = latest_device_status_response.json()
                count += 1
                current_datetime=   datetime.now()
                date_time_difference = current_datetime - datetime.strptime(result['created_at'], '%Y-%m-%dT%H:%M:%SZ')
                date_time_difference_in_hours = date_time_difference.total_seconds() / 3600
                print(date_time_difference_in_hours)
                if date_time_difference_in_hours >5: #3hours for timezone difference
                    count_of_offline_devices += 1
                    offline_devices.append(result)
                else : 
                    count_of_online_devices +=1
                    online_devices.append(result)

        print(count)
        print(count_of_online_devices)
        print(count_of_offline_devices)

        online_devices_percentage = math.ceil((count_of_online_devices/count)* 100)
        offline_devices_percentage = math.ceil((count_of_offline_devices/count)* 100)
        print('online device percentage is : {}%'.format(online_devices_percentage))
        print('offline device percentage is: {}%'.format(offline_devices_percentage))

        device_status_results =[]
    
        created_at =   str_to_date(date_to_str(datetime.now()))
        record = {"online_devices_percentage":online_devices_percentage,
         "offline_devices_percentage":offline_devices_percentage, "created_at":created_at, 
         "total_active_device_count":count, "count_of_online_devices":count_of_online_devices,
          "count_of_offline_devices":count_of_offline_devices, "online_devices":online_devices, "offline_devices":offline_devices}
        device_status_results.append(record)

        print(device_status_results)

        save_hourly_device_status_check_results(device_status_results)       
        #return response.json(), response.status_code 



def save_hourly_device_status_check_results(data):
    """
    """
    for i  in data:
        print(i)
        db.device_status_hourly_check_results.insert_one(i)
        print('saved')


if __name__ == '__main__':    
    get_device_channel_status()