from google.cloud import bigquery
from geopy import distance
#from api import model_config
from api import model_config
import json
import pytz
from datetime import datetime

def load_json_data(full_file_path):
    data = None
    with open(full_file_path, 'r') as fp:
        data = json.load(fp)
    return data

def save_json_data(file_name, data_to_save):
     with open(file_name, 'w') as fp:
        json.dump(data_to_save, fp) #obtained_best_config_dict


def checkKey(dict, key): 
    if key in dict.keys(): 
        return dict[key]
    else: 
        return "Channel Id Not available"


def get_closest_channel(latitude, longitude) -> int:
    '''gets and returns the channel with the minimum distance 
     from the location with the specified latitude and longitude'''
    specified_coordinates = (latitude  , longitude)
    all_channel_coordinates_dict = model_config.CHANNEL_ID_COORDINATES_CONFIG_DICT
    channel_ids_with_distances_from_specified_coordinates = {}

    for channel_id, coordinates in all_channel_coordinates_dict.items():
        #print(channel_id, ":", "latitude :",coordinates.get('latitude'), 
            #"longitude :", coordinates.get('longitude'))
        channel_coordinates = (coordinates.get('latitude'), coordinates.get('longitude'))
        distance_between_coordinates = distance.distance(specified_coordinates, channel_coordinates).km
        channel_ids_with_distances_from_specified_coordinates[channel_id]= distance_between_coordinates

    #print(channel_ids_with_distances_from_specified_coordinates)
    channel_id_with_min_distance= min(channel_ids_with_distances_from_specified_coordinates.keys(), key=(lambda k: channel_ids_with_distances_from_specified_coordinates[k]))
    minimum_distance = channel_ids_with_distances_from_specified_coordinates[channel_id_with_min_distance]
    print(minimum_distance, channel_id_with_min_distance)
    return channel_id_with_min_distance

def convert_local_string_date_to_tz_aware_datetime(local_date_string):
    timezone = pytz.timezone('Africa/Kampala')
    date_time_obj = datetime.strptime(local_date_string, '%Y-%m-%d %H:%M:%S+3:00')
    timezone_date_time_obj = timezone.localize(date_time_obj)
    return timezone_date_time_obj

if __name__ == '__main__':
    #channel_id = get_channel_id("0.693610","34.181519")
    #print(channel_id)

    #get_closest_channel(0.540184, 31.439622)

    #get_all_coordinates()
    best_config = load_json_data(model_config.BEST_CONFIG_FROM_AVERAGES_MODEL)
    print(type(best_config))
    print(best_config)
    
    
    
    

    