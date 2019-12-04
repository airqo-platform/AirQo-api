import pandas as pd
import numpy as np
import json, requests
import datetime as dt
from datetime import datetime,timedelta
import os
import pickle
import processing as ps
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import atexit
import time
from flask import Flask, request, jsonify
from bson import json_util 

from app import mongo


#Defining variables to be used
#Column names for the different types of sensors
PMS_heads_7 = ['time', 'entry_id', 'pm2_5', 'pm10', 's2_pm2_5', 's2_pm10', 'lat', 'long', 'voltage', 'channel_id']
PMS_heads_8 = ['time', 'entry_id', 'pm2_5', 'pm10', 's2_pm2_5', 's2_pm10', 'lat', 'long', 'voltage', 'gps_data', 'channel_id']
OPC_N2_heads_7 = ['time', 'entry_id', 'pm1', 'pm2_5', 'pm10', 'sample_period', 'lat', 'long', 'voltage', 'channel_id']
OPC_N2_heads_8 = ['time', 'entry_id', 'pm1', 'pm2_5', 'pm10', 'sample_period', 'lat', 'long', 'voltage', 'gps_data', 'channel_id']
PA_heads = ['time', 'entry_id', 'pm1', 'pm2_5', 'pm10', 'uptime', 'RSSI', 'temp', 'humidity', 'pm2_5_cf1', 'channel_id']

#Function to insert all raw data to a collection and the cleaned one to a different collection
def insert_channel_data():
    
    raw_collection = mongo.db.raw
    clean_collection = mongo.db.processed
    meta = mongo.db.meta


    for doc in meta.find():
        channel_id = doc['channel_id']
        channel_key = doc['read_api_key']
        filename = doc['channel_name']
        channel_url = 'http://thingspeak.com/channels/'+str(channel_id)
        
        data = download(channel_url, verbose = True, apikey = channel_key)
        df = pd.DataFrame(data)#creating a dataframe of the data
    
        df['created_at'] =  pd.to_datetime(df['created_at']) #converting to DateTime format
        df['created_at'] = df['created_at'].dt.tz_convert('Africa/Kampala') #Converting from UTC to EAT
    
        df['channel_id'] = channel_id #adding an additional column

        columns = len(df.columns)
        if (('AQ_' in filename) and (columns==11)):
            df.columns = PMS_heads_8
        elif(('AQ_' in filename) and (columns==10)):
            df.columns = PMS_heads_7  
        elif ('PA' in filename):
            df.columns = PA_heads
            if ('PA_01' in filename): #International School Lubowa
                df['lat'] = 0.2357
                df['long'] = 32.5576
            elif ('PA_02' in filename): #Makerere
                df['lat'] = 0.332050  #estimates
                df['long'] = 32.570509
            elif ('PA_03' in filename): #Kabale
                df['lat'] = -1.245 
                df['long'] = 29.9892
            elif ('PA_04' in filename): #Bunamwaya
                df['lat'] = 0.27
                df['long'] = 32.558
        elif (('8A' in filename) or ('6F' in filename)):
            df.columns = OPC_N2_heads_8
        else:
            df.columns = OPC_N2_heads_7
            
        df['lat'] = df['lat'].replace([0.000000,1000.000000], np.nan)
        df['long'] = df['long'].replace([0.000000,1000.000000], np.nan)
        
        records = json.loads(df.T.to_json()).values()
        raw_collection.insert_many(records)
        print('Channel %s\'s raw data successful!' %channel_id)

        if (('AQ_' in filename) and (columns==11)):
            columns_to_drop = ['entry_id', 'gps_data']
            ps.drop_columns(df, columns_to_drop)
        elif(('AQ_' in filename) and (columns==10)):
            columns_to_drop = ['entry_id']
            ps.drop_columns(df, columns_to_drop)
        elif ('PA' in filename):
            columns_to_drop = ['entry_id', 'up_time', 'RSSI', 'pm2_5_cf1']
            ps.drop_columns(df, columns_to_drop)
        elif (('8A' in filename) or ('6F' in filename)):
            columns_to_drop = ['entry_id','sample_period','gps_data']
            ps.drop_columns(df, columns_to_drop)
        else:
            columns_to_drop = ['entry_id','sample_period']
            ps.drop_columns(df, columns_to_drop)
            
        ps.setindex(df)
        ps.change_datatypes(df)
        ps.clean_coordinates(df)
        ps.clean_pm25(df)
        ps.clean_pm10(df)
        ps.averages(df)

        if df.empty == True:
            print('No clean data for this channel')
        else:
            clean_records = json.loads(df.T.to_json()).values()
            clean_collection.insert_many(clean_records)
            print('Channel %s\'s clean data successful!' %channel_id)

    return "All channel data on ThingSpeak has been inserted into the new database"


#Function to insert new raw data to a collection and the cleaned one to a different collection
def insert_new_data():

    raw_collection = mongo.db.raw
    clean_collection = mongo.db.processed
    meta_collection = mongo.db.meta

    for doc in meta_collection.find():
        channel_id = doc['channel_id']
        channel_key = doc['read_api_key']
        filename = doc['channel_name']
        channel_url = 'http://thingspeak.com/channels/'+str(channel_id)
        
        data = download_new(channel_url, verbose = True, apikey = channel_key)
        df = pd.DataFrame(data)#creating a dataframe of the data

        if df.empty == True:
            print ('No new data for channel %s' %channel_id)
        else:
    
            df['created_at'] =  pd.to_datetime(df['created_at']) #converting to DateTime format
            df['created_at'] = df['created_at'].dt.tz_convert('Africa/Kampala') #Converting from UTC to EAT
    
            df['channel_id'] = channel_id #adding an additional column

            columns = len(df.columns)
            if (('AQ_' in filename) and (columns==11)):
                df.columns = PMS_heads_8
            elif(('AQ_' in filename) and (columns==10)):
                df.columns = PMS_heads_7  
            elif ('PA' in filename):
                df.columns = PA_heads
                if ('PA_01' in filename): #International School Lubowa
                    df['lat'] = 0.2357
                    df['long'] = 32.5576
                elif ('PA_02' in filename): #Makerere
                    df['lat'] = 0.332050  #estimates
                    df['long'] = 32.570509
                elif ('PA_03' in filename): #Kabale
                    df['lat'] = -1.245 
                    df['long'] = 29.9892
                elif ('PA_04' in filename): #Bunamwaya
                    df['lat'] = 0.27
                    df['long'] = 32.558
            elif (('8A' in filename) or ('6F' in filename)):
                df.columns = OPC_N2_heads_8
            else:
                df.columns = OPC_N2_heads_7
            
            df['lat'] = df['lat'].replace([0.000000,1000.000000], np.nan)
            df['long'] = df['long'].replace([0.000000,1000.000000], np.nan)
        
            records = json.loads(df.T.to_json()).values()
            raw_collection.insert_many(records)
            print('Channel %s\'s new raw data successful!' %channel_id)

            if (('AQ_' in filename) and (columns==11)):
                columns_to_drop = ['entry_id', 'gps_data']
                ps.drop_columns(df, columns_to_drop)
            elif(('AQ_' in filename) and (columns==10)):
                columns_to_drop = ['entry_id']
                ps.drop_columns(df, columns_to_drop)
            elif ('PA' in filename):
                columns_to_drop = ['entry_id', 'up_time', 'RSSI', 'pm2_5_cf1']
                ps.drop_columns(df, columns_to_drop)
            elif (('8A' in filename) or ('6F' in filename)):
                columns_to_drop = ['entry_id','sample_period','gps_data']
                ps.drop_columns(df, columns_to_drop)
            else:
                columns_to_drop = ['entry_id','sample_period']
                ps.drop_columns(df, columns_to_drop)
            
            ps.setindex(df)
            ps.change_datatypes(df)
            ps.clean_coordinates(df)
            ps.clean_pm25(df)
            ps.clean_pm10(df)
            ps.averages(df)

            if (df.empty) == True:
                print('No clean data for this channel')
            else:
                clean_records = json.loads(df.T.to_json()).values()
                if len(clean_records)==1:
                    clean_collection.insert_one(clean_records)
                else: 
                    clean_collection.insert_many(clean_records)
                print('%d new records added to Channel %s!' %(len(clean_records), channel_id))

    return "New data from all channels on ThingSpeak has been inserted into the database"




#function to download raw data for a channel from Thingspeak
def download(apiurl,cache='use',verbose=False,apikey=None,cacheonly=None):
    """
    download(apiurl,cache='use',verbose=False,apikey=None):
    Loads thingspeak data from apiurl
    Set cache to:
        'use' - to use it
        'refresh' - to not use it
        'only' - to only use it
    cacheonly = if set, only cache this many previous training points,
       will only report this many when output. This is useful to avoid
       caches becoming arbitrarily large with historic data.
    """
    filename = 'channel%s.p'%apiurl.split('/')[-1]
    cachefile = os.path.isfile(filename)
    if (cache=='use' or cache=='only') and cachefile:
        alldata = pickle.load( open( filename, "rb" ) )
        if (cache=='only'):
            if verbose: print("Using just cache - may be out of date")
            return alldata
        if verbose: print("Using cache")
        nextid = alldata[-1]['entry_id']+1
        endtime = str_to_date(alldata[-1]['created_at'])+timedelta(seconds=1)
    else: #no cachefile or refresh -> we want to reload from the API
        if verbose: print("Ignoring/overwriting cache")
        if (cache=='only'):
            ##TODO Throw exception - can't only use cache as there is no cache
            assert False, "Can't only use cache as there is no cache"
        nextid = 1
        alldata = []
        endtime = None  
    if (cache=='only'): #we should stop now, and use the cached data we've got
        return alldata
        
    result = None
    if verbose: print("Using %d records from cache" % len(alldata))
    while result != -1:
        #thingspeak doesn't let you download ranges of ids, instead you have to
        #download ranges of dates. We can only download 8000 at a time, so we
        #need to get the date of the next one we need (then we ask for that datetime
        #until now, and repeat until we run out of new items).
        url = apiurl+'/feeds/entry/%d.json' % (nextid)
        if apikey is not None: url += '?api_key=%s' % apikey
        print("Loading from %s" % url)
        result = json.loads(requests.post(url, timeout = 100.0).content.decode('utf-8'))
        starttime = endtime
        if result==-1:
            #if verbose: print("Warning: Unable to retrieve data (does channel exist? is it public?)")
            endtime = datetime.now()
        else:
            endtime = str_to_date(result['created_at'])
        if (nextid==1):
            starttime = endtime
        else:
            start = datetime.strftime(starttime,'%Y-%m-%dT%H:%M:%SZ')
            end = datetime.strftime(endtime-timedelta(seconds=1),'%Y-%m-%dT%H:%M:%SZ')
            url = apiurl+'/feeds.json?start=%s&end=%s' % (start,end)
            if apikey is not None: url += '&api_key=%s' % apikey
            print("Loading from %s" % url)                        
            data = json.loads(requests.post(url, timeout = 100.0).content.decode('utf-8'))
            if (data!=-1):
                alldata.extend(data['feeds'])
                if verbose: print("    Adding %d records..." % len(data['feeds']))
            else:
                if verbose: print("Warning: unable to read data feed")
            
        nextid += 7999 #thought download was 8000 fields, but it's 8000 records. 8000/len(result)
    if verbose: print("New cache has %d records, saving." % len(alldata))
    
    if cacheonly is not None:
        pickle.dump( alldata[-cacheonly:], open( filename, "wb" ) )
    else:
        pickle.dump( alldata, open( filename, "wb" ) )
    return alldata

#function to download new data from Thingspeak
def download_new(apiurl,cache='use',verbose=False,apikey=None,cacheonly=None):
    """
    download(apiurl,cache='use',verbose=False,apikey=None):
    Loads thingspeak data from apiurl
    Set cache to:
        'use' - to use it
        'refresh' - to not use it
        'only' - to only use it
    cacheonly = if set, only cache this many previous training points,
       will only report this many when output. This is useful to avoid
       caches becoming arbitrarily large with historic data.
    """
    filename = 'channel%s.p'%apiurl.split('/')[-1]
    cachefile = os.path.isfile(filename)
    if (cache=='use' or cache=='only') and cachefile:
        alldata = pickle.load( open( filename, "rb" ) )
        if (cache=='only'):
            if verbose: print("Using just cache - may be out of date")
            return alldata
        #if verbose: print("Using cache")
        nextid = alldata[-1]['entry_id']+1
        endtime = str_to_date(alldata[-1]['created_at'])+timedelta(seconds=1)
    else: #no cachefile or refresh -> we want to reload from the API
        #if verbose: print("Ignoring/overwriting cache")
        if (cache=='only'):
            ##TODO Throw exception - can't only use cache as there is no cache
            assert False, "Can't only use cache as there is no cache"
        nextid = 1
        alldata = []
        endtime = None  
    #if (cache=='only'): #we should stop now, and use the cached data we've got
    #    return alldata
        
    result = None
    #if verbose: print("Using %d records from cache" % len(alldata))
    while result != -1:
        #thingspeak doesn't let you download ranges of ids, instead you have to
        #download ranges of dates. We can only download 8000 at a time, so we
        #need to get the date of the next one we need (then we ask for that datetime
        #until now, and repeat until we run out of new items).
        url = apiurl+'/feeds/entry/%d.json' % (nextid)
        if apikey is not None: url += '?api_key=%s' % apikey
        print("Loading from %s" % url)
        result = json.loads(requests.post(url, timeout = 100.0).content.decode('utf-8'))
        starttime = endtime
        if result==-1:
            #if verbose: print("Warning: Unable to retrieve data (does channel exist? is it public?)")
            endtime = datetime.now()
        else:
            endtime = str_to_date(result['created_at'])
        if (nextid==1):
            starttime = endtime
        else:
            start = datetime.strftime(starttime,'%Y-%m-%dT%H:%M:%SZ')
            end = datetime.strftime(endtime-timedelta(seconds=1),'%Y-%m-%dT%H:%M:%SZ')
            url = apiurl+'/feeds.json?start=%s&end=%s' % (start,end)
            if apikey is not None: url += '&api_key=%s' % apikey
            print("Loading from %s" % url)                        
            data = json.loads(requests.post(url, timeout = 100.0).content.decode('utf-8'))
            if (data!=-1):
                new_data = data['feeds']
                alldata.extend(new_data)
                if verbose: print("Adding %d new records..." % len(new_data))
            else:
                if verbose: print("Warning: unable to read data feed")
            
        nextid += 7999 #thought download was 8000 fields, but it's 8000 records. 8000/len(result)
    if verbose: print("New cache has %d records, saving." % len(alldata))
    
    if cacheonly is not None:
        pickle.dump( alldata[-cacheonly:], open( filename, "wb" ) )
    else:
        pickle.dump( alldata, open( filename, "wb" ) )
    return new_data
    
#Function that converts a string to datetime format
def str_to_date(st):
    return datetime.strptime(st,'%Y-%m-%dT%H:%M:%SZ')

#Function to retrieve a channel's data
def download_channel_db(collection, reference_id, limit=None):
    collection = mongo.db[collection]
    
    if limit!=None:
        cursor = collection.find({"channel_id": reference_id}, limit = limit)
    else:
        cursor = collection.find({"channel_id": reference_id})
    
    print ('Relevant documents for channel %s retrieved' %reference_id)
    return jsonify(json_util.dumps(list(cursor)))
