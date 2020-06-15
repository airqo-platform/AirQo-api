#import app
from datetime import datetime, timedelta
#from helpers import db_helpers
import requests
import maths

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


    def get_device_channel_status(self):
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
    
             
        #return response.json(), response.status_code  

            
def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')

if __name__ == "__main__":
    dx = DeviceStatus()
    dx.get_device_channel_status()
