import json
import requests
from google.cloud import storage
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import os
import gpflow
from gpflow import set_trainable
import geopandas
from config import connect_mongo
from config import configuration
import argparse
from pathlib import Path
from helpers.get_data import get_pm_data

BASE_DIR = Path(__file__).resolve().parent
CREDENTIALS = configuration.CREDENTIALS
storage_client = storage.Client.from_service_account_json(CREDENTIALS)
shapefile_path = os.path.join(BASE_DIR,'shape_files')
#kawempe_ids = ['aq_54', 'aq_76', 'aq_94','aq_g507','aq_g508','aq_g509', 'aq_g512', 'aq_91', 'ANQ16PZJ', 'ALS2LCWY', 'AB6051M4', 
#'AW66FF7V', 'A743BPWK']
kawempe_ids = {'loc_54':832254, 'loc_76':930431, 'loc_80':1014691, 'loc_89':1351535, 'loc_90':1351540, 'loc_91':1351542, 
'loc_92':1351543, 'loc_93':1351546, 'loc_94':1014687, 'KCCA_KWPE_AQ01':'ANQ16PZJ', 'KCCA_KWPE_AQ02': 'ALS2LCWY', 
'KCCA_KWPE_AQ03':'AB6051M4', 'KCCA_KWPE_AQ04':'AW66FF7V', 'KCCA_KWPE_AQ05': 'A743BPWK'}

kampala_ids = {'aq_79':930434, 'aq_29':718028, 'aq_69':912224, 'aq_71':930426, 'aq_72':930427, 'aq_68':912223, 'aq_67':912222, 
'aq_65':912220, 'aq_61':870145, 'aq_59':870143, 'aq_60':870144, 'aq_63':870147, 'aq_58':870142, 'aq_56':870139, 'aq_55':832255, 
'aq_52':832252, 'aq_53':832253, 'aq_54':832254, 'aq_51':832251, 'aq_47':782720, 'aq_46':782719, 'aq_45':782718, 'aq_44':755614, 
'aq_43':755612, 'aq_62':870146, 'aq_39':737276, 'aq_36':737273, 'aq_26':689761, 'aq_30':718029, 'aq_31':718030, 'aq_32':730014, 
'aq_48':782721, 'aq_49':782722, 'aq_64':912219, 'aq_66':912221, 'aq_70':912225, 'aq_74':930429} #maybe add kcca devices


airqloud_dict = {'kampala':kampala_ids, 'kawempe':kawempe_ids}


def get_channels(airqloud_name):
    'returns a list of the channels in a given airqloud'
    return airqloud_dict[airqloud_name]

def get_channels_ts(airqloud_name):
    '''
    Gets details of channels whose data is to be used in training
    '''
    file_name = f'{airqloud_name}-api-keys.json'
    blob = storage_client.get_bucket('api-keys-bucket') \
        .get_blob(file_name) \
        .download_as_string()
    return json.loads(blob)

def download_seven_days_ts(channel_id, api_key):
    '''
    Downloads data from ThingSpeak for a specific channel for the past week
    '''
    channel_data = []
    result = 8000
    end_time = datetime.utcnow()
    start_time = end_time-timedelta(days=7)
    start = datetime.strftime(start_time, '%Y-%m-%dT%H:%M:%SZ')
    end = datetime.strftime(end_time, '%Y-%m-%dT%H:%M:%SZ')
    base_url = f'https://api.thingspeak.com/channels/{channel_id}/feeds.json'
    
    while (end_time > start_time) and (result==8000):
        channel_url = base_url+'?start='+start+'&end='+end
        print(channel_url)
        data = json.loads(requests.get(channel_url, timeout = 100.0).content.decode('utf-8'))
        if (data!=-1 and len(data['feeds'])>0):
            channel_data.extend(data['feeds'])
            end = data['feeds'][0]['created_at']
            result = len(data['feeds'])
            print(result)
            end_time = datetime.strptime(end, '%Y-%m-%dT%H:%M:%SZ') - timedelta(seconds=1)
        else:
            return pd.DataFrame()
    return pd.DataFrame(channel_data)

def preprocessing_ts(df):
    '''
    Preprocesses data for a particular channel
    '''
    df = df.drop_duplicates()
    df['field1'].fillna(df['field3'], inplace=True)
    df = df[['created_at','field1']]
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['field1'] = pd.to_numeric(df['field1'], errors='coerce')
    df = df.sort_values(by='created_at',ascending=False)
    df = df.set_index('created_at')
    hourly_df = df.resample('H').mean()
    hourly_df.dropna(inplace=True)
    hourly_df= hourly_df.reset_index()
    return hourly_df

def train_model(X, Y, airqloud):
    '''
    Creates a model, trains it using given data and saves it for future use
    '''
    print('training model function')
    Yset = Y
    Yset[Yset==0] = np.nan
    
    keep = ~np.isnan(Yset[:,0]) 
    Yset = Yset[keep,:]
    Xset = X[keep,:]
    print('Number of rows in Xset', Xset.shape[0])
    
    Xtraining = Xset[::2,:]
    Ytraining = Yset[::2,:]
    
    if airqloud == 'kampala':
        k = gpflow.kernels.RBF(lengthscales=[0.08, 0.08, 2]) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining), kernel=k, mean_function=None)
        set_trainable(m.kernel.kernels[0].lengthscales, False) 
    elif airqloud == 'kawempe':
        k = gpflow.kernels.RBF(variance=625) + gpflow.kernels.Bias()
        m = gpflow.models.GPR(data=(Xtraining, Ytraining), kernel=k, mean_function=None)
        m.likelihood.variance.assign(400)
        set_trainable(m.kernel.kernels[0].variance, False)
        set_trainable(m.likelihood.variance, False)
    
    opt = gpflow.optimizers.Scipy()

    def objective_closure():
             return - m.log_marginal_likelihood()

    opt_logs = opt.minimize(objective_closure, m.trainable_variables, options=dict(maxiter=100))

    return m

def get_bbox_coordinates(airqloud):
    path = f'{shapefile_path}/kampala_parishes/Kampala_Parishes_Lands_and_Survey_2012.shp'
    data = geopandas.read_file(path)
    data = data.to_crs(epsg=4326)
    if airqloud == 'kawempe':
        kawempe_data = data[data.SNAME_2006=='KAWEMPE DIVISION']
        min_long, min_lat, max_long, max_lat = kawempe_data.geometry.total_bounds
    elif airqloud == 'kampala':
        min_long, min_lat, max_long, max_lat = data.geometry.total_bounds
    else:
        #to be documented
        pass
    return min_long, max_long, min_lat, max_lat

#def download_airqloud_data_mongo(airqloud_name):
#    '''
#    downloads data from MongoDB for a specificied airqloud for the past week
#    '''
#    aq_dict = get_channels(airqloud_name)
#    total_records = [] #array to hold all devices' data
#    end_date =datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
#    start_date = (datetime.utcnow()-timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ')
#    for loc, device in aq_dict.items():
#        print(device)
#        if 'KCCA' in loc:
#            owner='kcca'
#        else:
#            owner= 'airqo'
#        pm_data = get_pm_data(device, owner, start_time=start_date, end_time=end_date)
#        total_records.extend(pm_data)
#    return total_records


if __name__=='__main__':
    print(get_channels_ts('kampala'))
    #print(download_airqloud_data('kawempe'))
