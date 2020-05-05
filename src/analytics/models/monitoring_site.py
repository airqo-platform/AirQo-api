import app 
from datetime import datetime,timedelta
from helpers import mongo_helpers, helpers

class MonitoringSite():
    """The class contains functionality for retrieving data related to monitoring sites.

    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.

    """
    
    def __init__(self):
        """ initialize """ 

    def get_location_devices_code(self, organisation_name, location_name):
        """
        Gets all the devices associated to the specified location name(parish name) for a particular organisation.

        Args:
            organisation_name: the name of the organisation whose monitoring site locations are to be returned. 
            location_name: the name of the location i.e. parish whose devices are to be returned.
        Returns:
            A list of the devices (device codes) associated with the specified organisation name and location name.
            
        """
        devices =[]
        query = {"$and":[{"Organisation":organisation_name},{"Parish":location_name}]}
        results = list(app.mongo.db.monitoring_site.find(query,
        {"DeviceCode": 1, "Parish":1, "LocationCode":1,"Division":1, "_id": 1} ))
        for result in results:
            obj = { "DeviceCode": result['DeviceCode'], 
                    'Parish': result['Parish'],
                    'Division': result['Division'],
                    'LocationCode':  result['LocationCode'],                    
                    '_id':str(result['_id'])}
            devices.append(obj) 

        return devices
                
    def get_monitoring_site(self, id ):
        """
        Gets the monitoring site with the specified id
        """
        pass

    def get_monitoring_site_locations(self, organisation_name):
        """
        Gets the locations(parish names) of all the monitoring site for a particular organisation.

        Args:
            organisation_name: the name of the organisation whose monitoring site locations are to be returned. 
            location_name: the name of the location i.e. parish whose devices are to be returned.

        Returns:
            A list of the monitoring site locations (parishes) associated with the specified organisation name.
            
        """
        results_x =[]
        results = list(app.mongo.db.monitoring_site.find({"Organisation":organisation_name},
        {"DeviceCode": 1, "Parish":1, "LocationCode":1,"Division":1,"LatestHourlyMeasurement":1, "_id": 1} ))
        for result in results:
            obj = { #"DeviceCode": result['DeviceCode'], 
                    #'Parish': result['Parish'],
                    #'Division': result['Division'],
                    'label':  result['Parish'],                    
                    'value':str(result['_id'])}
            results_x.append(obj) 

        return results_x


    
    def get_all_organisation_monitoring_sites(self, organisation_name):
        """
        Gets all the monitoring sites for the specified organisation. 
​
        Args:
            organisation_name: the name of the organisation whose monitoring sites are to be returned. 
​
        Returns:
            A list of the monitoring sites associated with the specified organisation name.
        """
        results_x =[]
        results = list(app.mongo.db.monitoring_site.find({"Organisation":organisation_name} ))
        #,{"DeviceCode": 1, "Parish":1, "LocationCode":1,"Division":1,"LatestHourlyMeasurement":1, "_id": 1}))
        #print(results)
        for result in results:
            if 'LatestHourlyMeasurement' in result:
                w = result['LatestHourlyMeasurement']
                last_hour_pm25_value = int(w[-1]['last_hour_pm25_value'])
                last_hour = helpers.date_to_formated_str(w[-1]['last_hour'])
            else:
                last_hour_pm25_value=0
                last_hour=''
            obj = {"DeviceCode": result['DeviceCode'], 
                    'Parish': result['Parish'],
                    'Division': result['Division'],
                    'Last_Hour_PM25_Value': last_hour_pm25_value,
                    'Latitude':result['Latitude'],
                    'Longitude': result['Longitude'],
                    'LocationCode':result['LocationCode'],
                    'LastHour':last_hour,
                    '_id':str(result['_id'])}
            results_x.append(obj)
        return results_x

    def get_all_organisation_monitoring_sitesx(self, organisation_name):
        """
        Gets all the monitoring sites for the specified organisation. 
​
        Args:
            organisation_name: the name of the organisation whose monitoring sites are to be returned. 
​
        Returns:
            A list of the monitoring sites associated with the specified organisation name.
        """
        results_x =[]
        results = list(app.mongo.db.monitoring_site.find({"Organisation":organisation_name} ))
        #,{"DeviceCode": 1, "Parish":1, "LocationCode":1,"Division":1,"LatestHourlyMeasurement":1, "_id": 1}))
        #print(results)
        for result in results:
            if 'LatestHourlyMeasurement' in result:
                w = result['LatestHourlyMeasurement']
                last_hour_pm25_value = round(w[-1]['last_hour_pm25_value'],2)
            else:
                last_hour_pm25_value=0          

            obj = {"DeviceCode": result['DeviceCode'], 
                    'Parish': result['Parish'],
                    'Division': result['Division'],
                    'Last_Hour_PM25_Value': last_hour_pm25_value,
                    'Latitude':result['Latitude'],
                    'Longitude': result['Longitude'],
                    '_id':str(result['_id'])}
            results_x.append(obj)            

        return results_x


    def get_device_past_28_days_measurements(self, device_code):
        """
        Gets all the daily measurements for the deviceo for the past 28 days from current day. 

        Args:
            device_code: the code of the devices whose measurements are to be returned. 

        Returns:
            A list of the daily measurements for the past 28 days.
        """
        endtime = helpers.date_to_str(datetime.now())
        starttime = helpers.date_to_str(datetime.now() - timedelta(days=28))        
        results = mongo_helpers.get_filtered_data(device_code,starttime, endtime,'daily','PM 2.5')
        #results = list(app.mongo.db..find({"deviceCode":device_code}))
        return results


    def get_all_devices_past_28_days_measurements(self):
        """
        Gets all the daily measurements for the deviceo for the past 28 days from current day. 

        Args:
            device_code: the code of the devices whose measurements are to be returned. 

        Returns:
            A list of the daily measurements for the past 28 days.
        """       
        created_at = helpers.str_to_date(helpers.date_to_str(datetime.now().date()))
        print(created_at)
        query = {'$match':{ 'created_at': {'$gte': created_at} }}
        projection = { '$project': { '_id': 0 }}
        results = list(app.mongo.db.device_daily_historical_averages.aggregate([query, projection]) )
        #results = list(app.mongo.db.device_daily_historical_averages.find({},{ "_id": 0}))        
        return results

    def update_all_monitoring_sites_latest_hourly_measurements(self):
        """
        inserts latest hourly measurements to all the monitoring site records.
        """
        results = list(app.mongo.db.monitoring_site.find({"Organisation":'KCCA'} ))
        for i  in results:
            key = {'_id': i['_id']} 
            query = {'deviceCode': i['DeviceCode']}
            print(i['DeviceCode'])
            last_record = list(app.mongo.db.device_hourly_measurements.find(query).sort([('time', -1)]).limit(1))
            if len(last_record)>0:
                obj = {
                    'last_hour': last_record[0]['time'], 
                    'last_hour_pm25_value': int(last_record[0]['characteristics']['pm2_5ConcMass']['value'])
                }            
                app.mongo.db.monitoring_site.update_one(
                    key,
                    { "$push": {"LatestHourlyMeasurement": obj }
                    })     
        

        
