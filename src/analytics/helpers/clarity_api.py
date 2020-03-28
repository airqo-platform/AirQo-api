import json
from datetime import datetime,timedelta
import requests
from config import Config
from app import mongo
from pymongo import MongoClient
import helpers
import mongo_helpers

class ClarityApi():    
    """
    """

    def __init__(self):
        """Initialises the class"""

       
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
                #print(i)                
                print('[!] Inserting - ', devices[i])
                mongo.db.devices.insert(devices[i])

    def save_clarity_device_measurements(self,average,code,startTime, limit ):
        """
         saves the measurements for the specified clarity device to airqo_analytics mongodb
         https://clarity-data-api.clarity.io/v1/measurements?startTime=2019-09-27T13:00:00Z&code=ANQ16PZJ&average=hour&limit=20000
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "/measurements?startTime="+startTime+"&code="+code+"&average="+average+"&limit="+str(limit)
        results = requests.get(api_url, headers=headers)
        device_measurements = results.json()
        if results.status_code  == 200: 
            for i in range(0, len(results.json())):              
                #print('[!] Inserting - ', device_measurements[i])
                mongo.db.device_measurements.insert(device_measurements[i])

    def save_clarity_device_daily_measurements(self,average,code,startTime, limit ):
        """
         saves the daily measurements for the specified clarity device to airqo_analytics mongodb
         https://clarity-data-api.clarity.io/v1/measurements?startTime=2019-09-27T13:00:00Z&code=ANQ16PZJ&average=day&limit=20000
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "/measurements?startTime="+startTime+"&code="+code+"&average="+average+"&limit="+str(limit)
        results = requests.get(api_url, headers=headers)
        device_measurements = results.json()
        if results.status_code  == 200: 
            for i in range(0, len(results.json())):            
                mongo.db.device_daily_measurements.insert(device_measurements[i])

    def save_clarity_raw_device_measurements(self, device_code):
        """
        gets all raw data for a device and saves it to MongoDB
        """
        base_url = 'https://clarity-data-api.clarity.io/v1/measurements?'

        results_list = []
        api_url = base_url + 'code=' + device_code
        headers = {'x-api-key': 'qJ2INQDcuMhnTdnIi6ofYX5X4vl2YYG4k2VmwUOy', 'Accept-Encoding': 'gzip'}
        results = requests.get(api_url, headers=headers)
        json_results = results.json()
    
        if len(json_results) == 0:
            return 'No data for specified parameters')
        else:
            for i in json_results:
                i['time'] = helpers.str_to_date(i['time'])
            results_list.extend(json_results)
        
            while len(json_results) != 0:#should stop when no result is returned
                endtime_date = results_list[-1]['time'] #getting the datetime of the last returned row
                next_start_time = endtime_date - timedelta(seconds=1)
                api_url = base_url+'endTime='+helpers.date_to_str(next_start_time)+'&code='+device_code
                results = requests.get(api_url, headers=headers, timeout = 100.0)
                json_results = results.json()
                if len(json_results)==0:
                    print ('Download Ended')
                else:
                    for i in json_results:
                        i['time'] = helpers.str_to_date(i['time'])
                    results_list.extend(json_results)
        mongo_helpers.insert_data_mongo(results_list)

    def update_raw_clarity_data(device_code):
        """
        Gets new raw data for a specific device and inserts into MongoDB
        """
        last_time = mongo_helpers.get_last_time(device_code)
        endtime = helpers.date_to_str(datetime.now())
        results_list = []
        api_url = base_url+'startTime='+helpers.date_to_str(last_time)+ '&endTime='+endtime+'&code='+device_code
        headers = {'x-api-key': 'qJ2INQDcuMhnTdnIi6ofYX5X4vl2YYG4k2VmwUOy', 'Accept-Encoding': 'gzip'}
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
            while len(json_results) != 0:#should stop when no result is returned
                endtime_date = results_list[-1]['time'] #getting the datetime of the last returned row
                endtime_string = helpers.date_to_str(endtime)
                next_endtime = endtime_date - timedelta(seconds=1)
                api_url = base_url+'startTime='+last_time+ '&endTime='+next_endtime+'&code='+device_code
                results = requests.get(api_url, headers=headers)
                json_results = results.json()
                if len(json_results)==0:
                    print ('Download Completed')
                else:
                    for i in json_results:
                        i['time'] = helpers.str_to_date(i['time'])
                    results_list.extend(json_results)
        mongo_helpers.insert_data_mongo(results_list)


if __name__ == '__main__':
    clarity_object = ClarityApi()
    clarity_object.save_clarity_devices()

                
           
    
  
