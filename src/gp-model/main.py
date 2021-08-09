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


def get_channels(airqloud):
    'returns a list of the channels in a given airqloud'
    return airqloud_dict[airqloud]

def get_channels_ts(airqloud):
    '''
    Gets details of channels whose data is to be used in training
    '''
    file_name = f'{airqloud}-api-keys.json'
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
    else:
        #to be defined --raise exception?
        pass
    
    opt = gpflow.optimizers.Scipy()

    def objective_closure():
             return - m.log_marginal_likelihood()

    opt_logs = opt.minimize(objective_closure, m.trainable_variables, options=dict(maxiter=100))

    return m

def get_bbox_coordinates(airqloud):
    path = f'{shapefile_path}/kampala_parishes/Kampala_Parishes_Lands_and_Survey_2012.shp'
    data = geopandas.read_file(path)
    data = data.to_crs(epsg=4326)
    new_data = data[['SNAME_2006', 'DNAME_2006', 'geometry']]
    if airqloud == 'kawempe':
        kampala_divisions = new_data.dissolve(by='SNAME_2006')
        polygon = kampala_divisions.loc['KAWEMPE DIVISION']['geometry']
    elif airqloud == 'kampala':
        kampala_district = new_data.dissolve(by='DNAME_2006')
        polygon = kampala_district.loc['KAMPALA']['geometry']  
    else:
        #to be documented .. raise exception?
        pass
    min_long, min_lat, max_long, max_lat= polygon.bounds
    return polygon, min_long, max_long, min_lat, max_lat

def point_in_polygon(row, polygon):
    from shapely.geometry import Point, shape
    mypoint = Point(row.longitude, row.latitude)
    if polygon.contains(mypoint):
        return 'True'
    else:
        return 'False'

def predict_model(m, tenant, airqloud):
    '''
    Makes the predictions and stores them in a database
    '''
    time = datetime.now().replace(microsecond=0, second=0, minute=0).timestamp()/3600
    polygon, min_long, max_long, min_lat, max_lat = get_bbox_coordinates(airqloud)

    longitudes = np.linspace(min_long, max_long, 100)
    latitudes = np.linspace(min_lat, max_lat, 100)
    locations = np.meshgrid(longitudes, latitudes)
    locations_flat = np.c_[locations[0].flatten(),locations[1].flatten()]

    df = pd.DataFrame(locations_flat, columns=['longitude', 'latitude'])
    df['point_exists'] = df.apply(lambda row: point_in_polygon(row, polygon), axis=1)
    new_df = df[df.point_exists=='True']
    new_df.drop('point_exists', axis=1, inplace=True)
    new_df.reset_index(drop=True, inplace=True)

    new_array = np.asarray(new_df)
    pred_set = np.c_[new_array,np.full(new_array.shape[0], time)]
    mean, var = m.predict_f(pred_set)
    
    means = mean.numpy().flatten()
    variances = var.numpy().flatten()
    std_dev = np.sqrt(variances)
    # calculate prediction interval
    interval = 1.96 * std_dev
    # lower, upper = means - interval, means + interval
        
    result = []
    for i in range(pred_set.shape[0]):
        result.append({'latitude':locations_flat[i][1],
                      'longitude':locations_flat[i][0],
                      'predicted_value': means[i],
                      'variance':variances[i],
                      'interval':interval[i],
                      'airqloud':airqloud,
                      'created_at': datetime.now()})

    
    db = connect_mongo(tenant)
    collection = db['gp_predictions']
    
    if collection.count_documents({'airqloud': airqloud})!= 0:
        collection.delete_many({'airqloud': airqloud})
    
    collection.insert_many(result)

    return result

def periodic_function(tenant, airqloud):
    '''
    Re-trains the model regularly
    '''
    print('starting')
    X = np.zeros([0,3])
    Y = np.zeros([0,1])
    channels = get_channels_ts(airqloud)
    print('ongoing')
    for channel in channels:
        d = download_seven_days_ts(channel['id'], channel['api_key'])
        if d.shape[0]!=0:
            d = preprocessing_ts(d)
            df = pd.DataFrame({'channel_id':[channel['id']], 
                                'longitude':[channel['long']], 
                                'latitude':[channel['lat']]})
        
            Xchan = np.c_[np.repeat(np.array(df)[:,1:],d.shape[0],0),[n.timestamp()/3600 for n in d['created_at']]]
            Ychan = np.array(d['field1'])
            X = np.r_[X,Xchan]
            Y = np.r_[Y,Ychan[:, None]]
    m = train_model(X, Y, airqloud)
    predict_model(m, tenant, airqloud)


if __name__=='__main__':
    parser = argparse.ArgumentParser(description='save gpmodel prediction.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')

    args = parser.parse_args()
    periodic_function(args.tenant, 'kampala')
    periodic_function(args.tenant, 'kawempe')
