import json
from datetime import datetime,timedelta
import requests
from config import Config
from app import mongo
from helpers import helpers
from helpers import mongo_helpers
from bson import json_util, ObjectId

class ClarityApi():    
    """ Helper class that handles all functionality
     for retrieving data from clarity api as well as
      saving them to application database.
    """

    def __init__(self):
        """Initialises the class"""


    def update_device_daily_measurements(self, device_code, average):
        '''
        Gets new daily data for a specific device and inserts into MongoDB
        '''
        last_time = helpers.date_to_str(mongo_helpers.get_last_time_from_device_hourly_measurements(device_code))
        endtime = helpers.date_to_str(datetime.now())

        headers = {'x-api-key': Config.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        base_url = Config.CLARITY_API_BASE_URL + "measurements?"
        api_url=  Config.CLARITY_API_BASE_URL + "measurements?startTime="+last_time+ '&endTime='+endtime+"&code="+device_code+"&average="+average
        results = requests.get(api_url, headers=headers)
        results_list = []
        
        json_results = results.json()    
        
        if len(json_results) ==0:
            return 'No new data found'
        elif len(json_results)<500: 
            for i in json_results:
                i['time'] = helpers.str_to_date(i['time'])
                i['device']= ObjectId(i['device'])
            results_list.extend(json_results)
        else:
            results_list.extend(json_results)
            while len(json_results) != 0:
                endtime_date = results_list[-1]['time']                
                next_endtime = endtime_date - timedelta(seconds=1)
                api_url = base_url+'startTime='+helpers.date_to_str(last_time)+ '&endTime='+helpers.date_to_str(next_endtime)+'&code='+device_code + "&average="+average
                results = requests.get(api_url, headers=headers)
                json_results = results.json()
                if len(json_results)==0:
                    pass
                else:
                    for i in json_results:
                        i['time'] = helpers.str_to_date(i['time'])
                        i['device']= ObjectId(i['device'])                        
                    results_list.extend(json_results)
        mongo_helpers.update_daily_measurements(results_list)

    def update_device_hourly_measurements(self, device_code, average):
        '''
        Gets new hourly data for a specific device and inserts into MongoDB
        '''
        last_time = mongo_helpers.get_last_time_from_device_hourly_measurements(device_code)
        endtime = helpers.date_to_str(datetime.now())

        headers = {'x-api-key': Config.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        base_url = Config.CLARITY_API_BASE_URL + "measurements?"
        api_url=  Config.CLARITY_API_BASE_URL + "measurements?startTime="+helpers.date_to_str(last_time + timedelta(hours=1))+ '&endTime='+endtime+"&code="+device_code+"&average="+average
        results = requests.get(api_url, headers=headers)
        results_list = []
        
        json_results = results.json()    
        
        if len(json_results) ==0:
            return 'No new data found'
        elif len(json_results)<500: 
            for i in json_results:
                i['time'] = helpers.str_to_date(i['time'])
                i['device']= ObjectId(i['device'])
            results_list.extend(json_results)
        else:
            results_list.extend(json_results)
            while len(json_results) != 0:
                endtime_date = results_list[-1]['time']                
                next_endtime = endtime_date - timedelta(seconds=1)
                api_url = base_url+'startTime='+helpers.date_to_str(last_time)+ '&endTime='+helpers.date_to_str(next_endtime)+'&code='+device_code + "&average="+average
                results = requests.get(api_url, headers=headers)
                json_results = results.json()
                if len(json_results)==0:
                    pass
                else:
                    for i in json_results:
                        i['time'] = helpers.str_to_date(i['time'])
                        i['device']= ObjectId(i['device'])                        
                    results_list.extend(json_results)
        mongo_helpers.update_hourly_measurements(results_list)    
      
    
       
    def get_all_devices(self):
        """
        gets all the devices info from clarity api.
        returns the devices info in json format.
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "/devices"
        results = requests.get(api_url, headers=headers)
        return results.json(), results.status_code 


    def get_device_measurements(self, code):
            """
             gets the measurements from a clarity device with the specified code.
            """
            parameters = {
            "code":code,         
            }
            return parameters
    
    def save_clarity_devices(self):
        """
         saves the clarity devices to airqo_analytics mongodb
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "/devices"
        results = requests.get(api_url, headers=headers)
        devices = results.json()
        if results.status_code  == 200: 
            for i in range(0, len(results.json())):                                
                print('[!] Inserting - ', devices[i])
                mongo.db.devices.insert(devices[i])

    def save_clarity_device_hourly_measurements(self,average,code,startTime, limit ):
        """
         saves the measurements for the specified clarity device to airqo_analytics mongodb
        
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "measurements?startTime="+startTime+"&code="+code+"&average="+average+"&limit="+str(limit)
        results = requests.get(api_url, headers=headers)
        device_measurements = results.json()
        if results.status_code  == 200: 
            for i in range(0, len(results.json())):                           
                mongo.db.device_hourly_measurements.insert(device_measurements[i])

    def save_clarity_device_daily_measurements(self,average,code,startTime, limit ):
        """
         saves the daily measurements for the specified clarity device to airqo_analytics mongodb
        
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "measurements?startTime="+startTime+"&code="+code+"&average="+average+"&limit="+str(limit)
        results = requests.get(api_url, headers=headers)
        device_measurements = results.json()
        if results.status_code  == 200: 
            for i in range(0, len(results.json())):            
                mongo.db.device_daily_measurements.insert(device_measurements[i])

    def save_clarity_device_hourly_measurements_v2(self, average, device_code ):
        """
         saves the hourly measurements for the specified clarity device to airqo_analytics mongodb
        
        """
        results_list = []
        headers = {'x-api-key': Config.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        api_url=  Config.CLARITY_API_BASE_URL + "measurements?code="+device_code+"&average="+average
       
        results = requests.get(api_url, headers=headers)
        json_results = results.json()

        if results.status_code  == 200:
            if len(json_results) == 0:
                return 'No data for specified parameters'
            else:
                for i in json_results:
                    i['time'] = helpers.str_to_date(i['time'])
                    i['device']= ObjectId(i['device'])
                results_list.extend(json_results)
        
                while len(json_results) != 0:
                    endtime = results_list[-1]['time']
                    endtime_string = helpers.date_to_str(endtime)
                    endtime_date = helpers.str_to_date(endtime_string)
                    next_start_time = endtime_date - timedelta(seconds=1)
                    api_url = api_url+'&endTime='+helpers.date_to_str(next_start_time)
                    results = requests.get(api_url, headers=headers)
                    json_results = results.json()
                    if len(json_results)==0:
                        print ('Download Ended')
                    else:
                        for i in json_results:
                            i['time'] = helpers.str_to_date(i['time'])
                            i['device']= ObjectId(i['device'])
                        results_list.extend(json_results)
            mongo_helpers.save_hourly_measurements(results_list)

    def save_clarity_device_daily_measurements_v2(self,average,device_code ):
        """
         saves the daily measurements for the specified clarity device to airqo_analytics mongodb
        
        """
        results_list = []
        headers = {'x-api-key': Config.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        api_url=  Config.CLARITY_API_BASE_URL + "measurements?code="+device_code+"&average="+average
       
        results = requests.get(api_url, headers=headers)
        json_results = results.json()

        if results.status_code  == 200:
            if len(json_results) == 0:
                return 'No data for specified parameters'
            else:
                for i in json_results:
                    i['time'] = helpers.str_to_date(i['time'])
                    i['device']= ObjectId(i['device'])
                results_list.extend(json_results)
        
                while len(json_results) != 0:
                    endtime = results_list[-1]['time']
                    endtime_string = helpers.date_to_str(endtime)
                    endtime_date = helpers.str_to_date(endtime_string)
                    next_start_time = endtime_date - timedelta(seconds=1)
                    api_url = api_url+'&endTime='+helpers.date_to_str(next_start_time)
                    results = requests.get(api_url, headers=headers)
                    json_results = results.json()
                    if len(json_results)==0:
                        print ('Download Ended')
                    else:
                        for i in json_results:
                            i['time'] = helpers.str_to_date(i['time'])
                            i['device']= ObjectId(i['device'])
                        results_list.extend(json_results)
            mongo_helpers.save_daily_measurements(results_list)

    def save_clarity_raw_device_measurements(self, device_code):
        """
        gets all raw data for a device and saves it to MongoDB
        """
        base_url = Config.CLARITY_API_BASE_URL+'measurements?'

        results_list = []
        api_url = base_url + 'code=' + device_code
        headers = {'x-api-key': Config.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        results = requests.get(api_url, headers=headers)
        json_results = results.json()
    
        if len(json_results) == 0:
            return 'No data for specified parameters'
        else:
            for i in json_results:
                i['time'] = helpers.str_to_date(i['time'])
                i['device']= ObjectId(i['device'])
            results_list.extend(json_results)
        
            while len(json_results) != 0:
                endtime = results_list[-1]['time']
                endtime_string = helpers.date_to_str(endtime)
                endtime_date = helpers.str_to_date(endtime_string)
                next_start_time = endtime_date - timedelta(seconds=1)
                api_url = base_url+'endTime='+helpers.date_to_str(next_start_time)+'&code='+device_code
                results = requests.get(api_url, headers=headers)
                json_results = results.json()
                if len(json_results)==0:
                    print ('Download Ended')
                else:
                    for i in json_results:
                        i['time'] = helpers.str_to_date(i['time'])
                        i['device']= ObjectId(i['device'])
                    results_list.extend(json_results)
        mongo_helpers.insert_data_mongo(results_list)


    def update_clarity_data(self, device_code):
        """
        Gets new data for a specific device and inserts into MongoDB
        """
        base_url =  Config.CLARITY_API_BASE_URL + "measurements?"
        last_time = mongo_helpers.get_last_time(device_code)
        endtime = helpers.date_to_str(datetime.now())
        results_list = []
        api_url = base_url+'startTime='+helpers.date_to_str(last_time)+ '&endTime='+endtime+'&code='+device_code
        headers = {'x-api-key': Config.CLARITY_API_KEY,
                'Accept-Encoding': 'gzip'}
        results = requests.get(api_url, headers=headers)
        json_results = results.json()
        
        for i in json_results:
            i['time'] = helpers.str_to_date(i['time'])
        
        if len(json_results) ==0:
            return 'No new data found'
        elif len(json_results)<500:
            results_list.extend(json_results)
        else:
            results_list.extend(json_results)
            while len(json_results) != 0:
                endtime_date = results_list[-1]['time']                
                next_endtime = endtime_date - timedelta(seconds=1)
                api_url = base_url+'startTime='+last_time+ '&endTime='+next_endtime+'&code='+device_code
                results = requests.get(api_url, headers=headers)
                json_results = results.json()
                if len(json_results)==0:
                    pass
                else:
                    for i in json_results:
                        i['time'] = helpers.str_to_date(i['time'])
                        i['device']= ObjectId(i['device'])                        
                    results_list.extend(json_results)
        mongo_helpers.insert_data_mongo(results_list)


if __name__ == '__main__':
    clarity_object = ClarityApi()
    clarity_object.save_clarity_devices()

               
           
    
  
