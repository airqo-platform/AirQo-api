import json
from datetime import datetime
import requests
from config import Config
from app import mongo

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
        
        """
        headers = {'x-api-key': Config.CLARITY_API_KEY}
        api_url=  Config.CLARITY_API_BASE_URL + "/measurements?startTime="+startTime+"&code="+code+"&average="+average+"&limit="+str(limit)
        results = requests.get(api_url, headers=headers)
        device_measurements = results.json()
        if results.status_code  == 200: 
            for i in range(0, len(results.json())):            
                mongo.db.device_daily_measurements.insert(device_measurements[i])



if __name__ == '__main__':
    clarity_object = ClarityApi()
    clarity_object.save_clarity_devices()

               
           
    
  
