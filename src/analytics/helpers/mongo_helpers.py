from helpers import helpers 
from pymongo import MongoClient
from app import mongo, MONGO_URI
from datetime import datetime, timedelta
import os
import sys

code_locations_dict = {'Luzira':'A9WLJS5F', 'Kawala':'AR2RHV97', 'Nakulabye':'AMBD741S', 'Namirembe':'ARBL6HVZ', 
'Kiswa':'APYZC5J7', 'Civic Centre':'A95X5F9T', 'Ggaba':'AKSLS0FP', 'Kazo Angola':'AW66FF7V', 'Kisugu':'APZ80RTM', 
'Kisenyi II':'AY2J2Q7Z', 'Kyebando':'ALS2LCWY', 'Placeholder1':'AQKNSLBV', 'Mutundwe':'AZB4PFV4', 'Bwaise II':'ANQ16PZJ', 
'Naguru I':'AGPZ1C42', 'Nakawa':'ADPYGHD0', 'Kamwokya II':'AJCK5L86', 'Wandegeya':'A743BPWK', 'Nsambya Central':'AX9RGBN0', 
'Komamboga':'AB6051M4', 'Kisenyi II':'AT6NJNZR', 'Nakasero II':'ARSWTW30', 'Placeholder3':'ANYRC92F', 'Kibuye I':'A0WN66FH', 
'Kyanja':'ACMVQ44H'}

MONGO_URI =os.getenv('MONGO_URI')

def connect_mongo():
    client = MongoClient(MONGO_URI)  
    db=client['airqo_analytics']
    return db


def save_device_daily_historical_averages(data):
    """
    """
    for i  in data:
        mongo.db.device_daily_historical_averages.insert(i)

def get_last_time_from_device_hourly_measurements(device_code):
        """ Gets the time of the latest record inserted in hourly device measurements.

        Args:
            device_code: the code used to identify the device.

        Returns:
            time for the last record inserted.

        """           
        query = {'deviceCode': device_code}
        last_record = list(mongo.db.device_hourly_measurements.find(query).sort([('time', -1)]).limit(1))
        last_time = last_record[0]['time']
        return last_time

def get_last_time_from_device_daily_measurements(device_code):
        """ Gets the time of the latest record inserted in daily device measurements.

        Args:
            device_code: the code used to identify the device.

        Returns:
            time for the last record inserted.

        """           
        query = {'deviceCode': device_code}
        last_record = list(mongo.db.device_daily_measurements.find(query).sort([('time', -1)]).limit(1))
        last_time = last_record[0]['time']
        return last_time

def update_hourly_measurements(data):
    """
     inserts new hourly measurements if they don't exist in db.
    """
    for i  in data:
        key = {'_id': i['_id']}        
        mongo.db.device_hourly_measurements.update(key,i, upsert=True)

def update_daily_measurements(data):
    """
     inserts new daily measurements if they don't exist in db.
    """
    for i  in data:
        key = {'_id': i['_id']}        
        mongo.db.device_daily_measurements.update(key,i, upsert=True)

def save_hourly_measurements(data):
    """
    Saves hourly measurements.
    """
    for i  in data:
        mongo.db.device_hourly_measurements.insert(i)
        

def save_daily_measurements(data):
    """
     Inserts daily measurements into device_daily_measurements collection.
    """
    for i  in data:
        mongo.db.device_daily_measurements.insert(i)

def insert_data_mongo(data):
    """
    Inserts raw clarity data into MongoDB
    """
    
    for i in data:
        mongo.db['device_raw_measurements'].insert_one(i)

def get_last_time(device_code):
    """
    Gets the time of the latest record in the MongoDB
    """
    
    
    query = {'deviceCode': device_code}
    last_record = list(mongo.db.device_raw_measurements.find(query).sort([('time', -1)]).limit(1))
    last_time = last_record[0]['time']
    return last_time

def get_filtered_data(device_code, start_date = None, end_date=None, frequency = 'daily', pollutant = 'PM 2.5'):
        """
        returns the data of a certain device with specified parameters
        """
        
        db = connect_mongo()
        if start_date == None:
            start = helpers.str_to_date_find('2019-06-01T00:00:00Z')
        else:
            start = helpers.str_to_date(start_date)
        if end_date == None:
            end = datetime.now()
        else:
            end = helpers.str_to_date(end_date)
        
        query = { 'deviceCode': device_code, 'time': {'$lte': end, '$gte': start} }
                                 
        if pollutant == 'PM 10':
            projection = { '_id': 0, 'time': 1, 'characteristics.pm10ConcMass.value':1 }
            if frequency =='hourly':
                records = list(db.device_hourly_measurements.find(query, projection))
            elif frequency=='daily':
                records = list(db.device_daily_measurements.find(query, projection))
            else:
                records = list(db.device_raw_measurements.find(query, projection))
            for i in range(len(records)):
                if records[i]['characteristics']['pm10ConcMass']['value'] >0 and records[i]['characteristics']['pm10ConcMass']['value'] <=54:
                    records[i]['backgroundColor'] = 'green'
                elif records[i]['characteristics']['pm10ConcMass']['value'] >54 and records[i]['characteristics']['pm10ConcMass']['value'] <=154:
                    records[i]['backgroundColor'] = 'yellow'
                elif records[i]['characteristics']['pm10ConcMass']['value'] > 154 and records[i]['characteristics']['pm10ConcMass']['value'] <= 254:
                    records[i]['backgroundColor'] = 'orange'
                elif records[i]['characteristics']['pm10ConcMass']['value'] > 254 and records[i]['characteristics']['pm10ConcMass']['value'] <= 354:
                    records[i]['backgroundColor'] = 'red'
                elif records[i]['characteristics']['pm10ConcMass']['value'] > 354 and records[i]['characteristics']['pm10ConcMass']['value'] <= 424:
                    records[i]['backgroundColor'] = 'purple'
                elif records[i]['characteristics']['pm10ConcMass']['value'] > 424 and records[i]['characteristics']['pm10ConcMass']['value'] <=604:
                    records[i]['backgroundColor'] = 'maroon'
                else:
                    records[i]['backgroundColor'] = 'gray'
            return records
        elif pollutant == 'NO2':
            projection = { '_id': 0, 'time': 1, 'characteristics.no2Conc.value':1 }
            if frequency =='hourly':
                records = list(db.device_hourly_measurements.find(query, projection))
            elif frequency=='daily':
                records = list(db.device_daily_measurements.find(query, projection))
            else:
                records = list(db.device_raw_measurements.find(query, projection))
            for i in range(len(records)):
                if records[i]['characteristics']['no2Conc']['value'] >0.0 and records[i]['characteristics']['no2Conc']['value'] <=53:
                    records[i]['backgroundColor'] = 'green'
                elif records[i]['characteristics']['no2Conc']['value'] > 53 and records[i]['characteristics']['no2Conc']['value'] <=100:
                    records[i]['backgroundColor'] = 'yellow'
                elif records[i]['characteristics']['no2Conc']['value'] > 100 and records[i]['characteristics']['no2Conc']['value'] <= 360:
                    records[i]['backgroundColor'] = 'orange'
                elif records[i]['characteristics']['no2Conc']['value'] > 360 and records[i]['characteristics']['no2Conc']['value'] <= 649:
                    records[i]['backgroundColor'] = 'red'
                elif records[i]['characteristics']['no2Conc']['value'] > 649 and records[i]['characteristics']['no2Conc']['value'] <= 1249:
                    records[i]['backgroundColor'] = 'purple'
                elif records[i]['characteristics']['no2Conc']['value'] > 1249 and records[i]['characteristics']['no2Conc']['value'] <=2049:
                    records[i]['backgroundColor'] = 'maroon'
                else:
                    records[i]['backgroundColor'] = 'gray'
            return records
        else:
            projection = { '_id': 0, 'time': 1, 'characteristics.pm2_5ConcMass.value':1 }
            if frequency =='hourly':
                records = list(db.device_hourly_measurements.find(query, projection))
            elif frequency=='daily':
                records = list(db.device_daily_measurements.find(query, projection))
            else:
                records = list(db.device_raw_measurements.find(query, projection))
            for i in range(len(records)):
                if records[i]['characteristics']['pm2_5ConcMass']['value'] >0.0 and records[i]['characteristics']['pm2_5ConcMass']['value'] <=12.0:
                    records[i]['backgroundColor'] = 'green'
                elif records[i]['characteristics']['pm2_5ConcMass']['value'] >12.0 and records[i]['characteristics']['pm2_5ConcMass']['value'] <=35.4:
                    records[i]['backgroundColor'] = 'yellow'
                elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 35.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 55.4:
                    records[i]['backgroundColor'] = 'orange'
                elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 55.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 150.4:
                    records[i]['backgroundColor'] = 'red'
                elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 150.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 250.4:
                    records[i]['backgroundColor'] = 'purple'
                elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 250.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <=500.4:
                    records[i]['backgroundColor'] = 'maroon'
                else:
                    records[i]['backgroundColor'] = 'gray'
            return records      

        
def get_piechart_data(device_code, start_date = None, end_date=None, frequency = 'daily', pollutant = 'PM 2.5'):
    '''
    returns the data to generate a pie chart given specific parameters
    '''
    records = get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
    if records:
        if pollutant == 'PM 2.5':
            #records = get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
            good_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >0.0 and 
            records[i]['characteristics']['pm2_5ConcMass']['value'] <=12.0)
            moderate_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >12.0 and 
            records[i]['characteristics']['pm2_5ConcMass']['value'] <=35.4)
            UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >35.4 and 
            records[i]['characteristics']['pm2_5ConcMass']['value'] <=55.4)
            unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >55.4 and 
            records[i]['characteristics']['pm2_5ConcMass']['value'] <=150.4)
            v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >150.4 and 
            records[i]['characteristics']['pm2_5ConcMass']['value'] <=250.4)
            hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >250.4 and 
            records[i]['characteristics']['pm2_5ConcMass']['value'] <=500.4)
            unknowns_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] <0.0 or 
            records[i]['characteristics']['pm2_5ConcMass']['value'] > 500.4)

        elif pollutant =='PM 10':
            #records = get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
            good_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >0.0 and 
            records[i]['characteristics']['pm10ConcMass']['value'] <=54)
            moderate_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >54 and 
            records[i]['characteristics']['pm10ConcMass']['value'] <=154)
            UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >154 and 
            records[i]['characteristics']['pm10ConcMass']['value'] <=254)
            unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >254 and 
            records[i]['characteristics']['pm10ConcMass']['value'] <=354)
            v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >354 and 
            records[i]['characteristics']['pm10ConcMass']['value'] <=424)
            hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >424 and 
            records[i]['characteristics']['pm10ConcMass']['value'] <=604)
            unknowns_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] <0.0 or 
            records[i]['characteristics']['pm10ConcMass']['value'] > 604)

        else:
            records = get_filtered_data(device_code, start_date, end_date, frequency, pollutant)
            good_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >0 and 
            records[i]['characteristics']['no2Conc']['value'] <=53)
            moderate_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >53 and 
            records[i]['characteristics']['no2Conc']['value'] <=100)
            UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >100 and 
            records[i]['characteristics']['no2Conc']['value'] <=360)
            unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >360 and 
            records[i]['characteristics']['no2Conc']['value'] <=649)
            v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >649 and 
            records[i]['characteristics']['no2Conc']['value'] <=1249)
            hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >1249 and 
            records[i]['characteristics']['no2Conc']['value'] <=2049)
            unknowns_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] <0.0 or 
            records[i]['characteristics']['no2Conc']['value'] > 2049)
        
        tasks = [good_sum, moderate_sum, UH4SG_sum, unhealthy_sum, v_unhealthy_sum, hazardous_sum, unknowns_sum]
    
    else:
        tasks = []
    return tasks

def get_exceedances(pollutant='PM 2.5', standard='WHO', frequency = 'daily'):
    '''
    Generates data for exceedances chart
    '''
    exceedances_list = []
    for location in code_locations_dict.keys():
        exceedances_dict = {}
        if standard == 'AQI':
            exceedances = get_AQI_exceedances(location, pollutant, frequency)   
            exceedances_dict['location'] = location
            exceedances_dict['UH4SG'] = exceedances[0]
            exceedances_dict['Unhealthy']= exceedances[1]
            exceedances_dict['VeryUnhealthy']= exceedances[2]
            exceedances_dict['Hazardous'] = exceedances[3]
            exceedances_list.append(exceedances_dict)
        else:
            exceedances = get_WHO_exceedances(location, pollutant, frequency)
            exceedances_dict['location'] = location
            exceedances_dict['exceedances']= exceedances
            exceedances_list.append(exceedances_dict)
    return exceedances_list

def get_WHO_exceedances(location, pollutant='PM 2.5', frequency='daily'):
    '''
    Returns exceedances based on the WHO limit
    '''
    device_code = code_locations_dict[location]
    end_date = datetime.now()
    start_date = end_date-timedelta(days=29)
    
    records = get_filtered_data(device_code, helpers.date_to_str(start_date), helpers.date_to_str(end_date), frequency, pollutant)
    
    if pollutant == 'NO2':
        exceedance_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] > 40)
        
    elif pollutant == 'PM 10':
        exceedance_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >50)

    else:
        exceedance_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >25.0)
    return exceedance_sum
    
def get_AQI_exceedances(location, pollutant='PM 2.5', frequency='daily'):
    '''
    Returns exceedances based on the AQI index
    '''
    device_code = code_locations_dict[location]
    end_date = datetime.now()
    start_date = end_date-timedelta(days=29)
    
    records = get_filtered_data(device_code, helpers.date_to_str(start_date), helpers.date_to_str(end_date), frequency, pollutant)
    
    if pollutant == 'NO2':
        UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >100 and 
        records[i]['characteristics']['no2Conc']['value'] <=360)
        unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >360 and 
        records[i]['characteristics']['no2Conc']['value'] <=649)
        v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >649 and 
        records[i]['characteristics']['no2Conc']['value'] <=1249)
        hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] >1249 and 
        records[i]['characteristics']['no2Conc']['value'] <=2049)
        
    elif pollutant == 'PM 10':
        UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >154 and 
        records[i]['characteristics']['pm10ConcMass']['value'] <=254)
        unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >254 and 
        records[i]['characteristics']['pm10ConcMass']['value'] <=354)
        v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >354 and 
        records[i]['characteristics']['pm10ConcMass']['value'] <=424)
        hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] >424 and 
        records[i]['characteristics']['pm10ConcMass']['value'] <=604)
    else:
        UH4SG_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >35.4 and 
        records[i]['characteristics']['pm2_5ConcMass']['value'] <=55.4)
        unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >55.4 and 
        records[i]['characteristics']['pm2_5ConcMass']['value'] <=150.4)
        v_unhealthy_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >150.4 and 
        records[i]['characteristics']['pm2_5ConcMass']['value'] <=250.4)
        hazardous_sum =sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] >250.4 and 
        records[i]['characteristics']['pm2_5ConcMass']['value'] <=500.4)
        
    #exceedances = {'UHSG':UH4SG_sum, 'Unhealthy':unhealthy_sum, 'Very Unhealthy':v_unhealthy_sum, 'Hazardous':hazardous_sum}
    exceedances = [UH4SG_sum, unhealthy_sum, v_unhealthy_sum, hazardous_sum]
    return exceedances
    