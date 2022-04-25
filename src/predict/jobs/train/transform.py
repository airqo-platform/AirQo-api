from os import name
import pandas as pd
from concurrent.futures import ThreadPoolExecutor
from models import Devices, Events, BoundaryLayer, Site
from utils import is_key_exist

def get_active_devices ():
    '''
    Get active devices with their site id
    '''
    devices = Devices.get_devices()

    # store device details plus site id 
    result = []
    for device in devices:
       site = {}
       if is_key_exist(device, 'site') == True:
           site['device'] =   device['name']  if is_key_exist(device,'name') == True else ''
           site['device_number'] =   device['device_number']  if is_key_exist(device,'device_number') == True else ''
           site['device_latitude'] =   device['latitude']  if is_key_exist(device,'latitude') == True else ''
           site['device_longitude'] =   device['longitude']  if is_key_exist(device,'longitude') == True else ''
           site['site_id'] =   device['site']['_id']  if is_key_exist(device['site'],'_id') == True else ''
       else:
            print(f'device {device} does not have site information')
       result.append(site)
    return pd.DataFrame(result)

def get_sites_details():
    '''
    Get site details. Returns sites metadata as a python pandas dataframe 
    '''
    sites = Site.get_sites()

    # store site details
    result = []

    for site in sites:
        data = {}
      
        data['site_id'] = site['_id'] if is_key_exist(site, '_id') == True else ''
        data['county'] =   site['county']  if is_key_exist(site,'county') == True else ''          
        data['site_name'] =   site['description'] if is_key_exist(site,'description') == True else ''
        data['site_latitude'] =   site['latitude'] if is_key_exist(site,'latitude') == True else ''
        data['site_longitude'] =    site['longitude'] if is_key_exist(site,'longitude') == True else ''
        data['altitude'] =   site['altitude'] if is_key_exist(site,'altitude') == True else ''
        data['road_dist'] =   site['distance_to_nearest_road'] if is_key_exist(site,'distance_to_nearest_road') == True else ''         
        data['land_use'] =   ''
        data['road_intensity'] =   ''
        data['road_status'] =   ''
        data['location_activities'] = ''
        data['aspect'] =   site['aspect'] if is_key_exist(site,'aspect') == True else ''
        data['landform_90'] =   site['landform_90'] if is_key_exist(site,'landform_90') == True else ''
        data['landform_270'] =   site['landform_270']  if is_key_exist(site,'landform_270') == True else ''        
        data['greeness'] =   site['greenness'] if is_key_exist(site,'greenness') == True else '' ## might need to pass time aspect
        data['traffic_factor'] =   ''
        data['parish'] =   site['parish'] if is_key_exist(site,'parish') == True else '' 
        data['district'] =   site['district'] if is_key_exist(site,'district') == True else '' 
        data['region'] =   ''
        data['sub_county'] =   site['sub_county']  if is_key_exist(site,'sub_county') == True else ''
        data['distance_to_nearest_road'] =   site['distance_to_nearest_road'] if is_key_exist(site,'distance_to_nearest_road') == True else ''
        data['distance_to_nearest_primary_road'] =   site['distance_to_nearest_primary_road'] if is_key_exist(site,'distance_to_nearest_primary_road') == True else ''
        data['distance_to_nearest_secondary_road'] =   site['distance_to_nearest_secondary_road'] if is_key_exist(site,'distance_to_nearest_secondary_road') == True else ''
        data['distance_to_nearest_tertiary_road'] =   site['distance_to_nearest_tertiary_road'] if is_key_exist(site,'distance_to_nearest_tertiary_road') == True else ''
        data['distance_to_nearest_unclassified_road'] =   site['distance_to_nearest_unclassified_road'] if is_key_exist(site,'distance_to_nearest_unclassified_road') == True else ''
        data['distance_to_nearest_residential_road'] =   site['distance_to_nearest_residential_road'] if is_key_exist(site,'distance_to_nearest_residential_road') == True else ''
        data['bearing_to_kampala_center'] =   site['bearing_to_kampala_center'] if is_key_exist(site,'bearing_to_kampala_center') == True else ''
        data['distance_to_kampala_center'] =   site['distance_to_kampala_center'] if is_key_exist(site,'distance_to_kampala_center') == True else ''
        # else:
        #     print(f'site {site} does not have information')
        result.append(data)
    return pd.DataFrame(result)



def get_metadata():
    '''Return device details and corresponding sites meta data'''
   
    devices = get_active_devices()
    sites = get_sites_details()

    # merge devices and sites dataframes using sites id
    metadata = pd.merge(devices, sites, how="inner", on=["site_id", "site_id"])

    return metadata.drop(columns=['site_id'])


def _transform_events(events):
    transformed_events = []
    for event in events:
        for value in event.get('values', []):
            transformed_event = {
                'pm2_5': value.get('pm2_5') and value.get('pm2_5').get('value'),
                'device_number': value.get('device_number'),
                'created_at': value.get('time'),
            }

            if transformed_event['created_at']:
                transformed_event['created_at'] = transformed_event['created_at'].isoformat()

            transformed_events.append(transformed_event)

    return pd.DataFrame(transformed_events)

def get_boundary_layer_data():
    boundaries = {boundary['hour']: boundary['height'] for boundary in BoundaryLayer().get_boundary_layer()}
    series =  pd.Series(boundaries)
    return pd.DataFrame(series, columns=['height']).reset_index().rename(columns={'index':'hour'})

def get_forecast_data():
    return _transform_events(Events().get_events_db())

def get_data():
    with ThreadPoolExecutor() as executor:
        forecast = executor.submit(get_forecast_data())
        boundary_layer = executor.submit(get_boundary_layer_data())
        meta = executor.submit(get_metadata())

        try:
            boundary_layer_data = boundary_layer.result()
            meta_data = meta.result()
            forecast_data = forecast.result()
            return boundary_layer_data, meta_data, forecast_data

        except Exception as exc:
            print("Could not retrieve data")
            print("Reason -", exc)
            return [], [], []
