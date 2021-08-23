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
from shapely.geometry import Point, Polygon, shape
from helpers.get_data import get_pm_data
#from multiprocessing import Process
from threading import Thread

BASE_DIR = Path(__file__).resolve().parent
#CREDENTIALS = configuration.CREDENTIALS
#storage_client = storage.Client.from_service_account_json(CREDENTIALS)
#shapefile_path = os.path.join(BASE_DIR,'shape_files')
EVENTS_URI=os.getenv('https://staging-platform.airqo.net/api/v1/devices/events')
LIST_DEVICES_URI=os.getenv('https://platform.airqo.net/api/v1/devices')
VIEW_AIRQLOUD_URI=os.getenv('https://staging-platform.airqo.net/api/v1/devices/airqlouds')

def get_all_devices(tenant):
    if tenant=='airqo':
        params = {'tenant':tenant,
                  'active': 'yes',
                  'primary': 'yes'
                 }
    else:
        params = {'tenant':tenant,
                  'active': 'yes',
                 }
        
    response = requests.get(LIST_DEVICES_URI, params=params)
    try:
        devices = response.json()['devices']
        if tenant == 'airqo':
            modified_devices = [{'name': device['name'],
                                 'chan_id': device['device_number'],
                                 'latitude': device['latitude'],
                                 'longitude': device['longitude']} for device in devices]
        elif tenant=='kcca':
             modified_devices = [{'name': device['name'],
                                 'chan_id': device['name'],
                                 'latitude': device['latitude'],
                                 'longitude': device['longitude']} for device in devices]
        return modified_devices
    except Exception as e:
        print('an exception occured')
        print(e)

def get_airqloud_polygon(tenant, airqloud):
    params = {'tenant':tenant,
              'name': airqloud
             }
    coords = requests.get(VIEW_AIRQLOUD_URI, params=params).json()['airqlouds'][0]['location']['coordinates']
    geo = {'type': 'Polygon', 'coordinates': coords}
    polygon = Polygon([tuple(l) for l in geo['coordinates'][0]])
    min_long, min_lat, max_long, max_lat= polygon.bounds
    return polygon, min_long, max_long, min_lat, max_lat




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
    thread1 = Thread(target=periodic_function, args=[args.tenant, 'kampala'])
    thread1.start()
    thread2 = Thread(target=periodic_function, args=[args.tenant, 'kawempe'])
    thread2.start()
