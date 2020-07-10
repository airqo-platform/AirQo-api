import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os
load_dotenv()
MONGO_URI = os.getenv('MONGO_URI')
# _config.MONGO_URI


class Location():
    def __init__(self):
        ''' 
        initialize 
        '''

    def register_location(self, loc_ref, host_name, mobility=None, longitude=None, latitude=None, road_intensity=None, description=None,
                          road_status=None, local_activities=None, loc_name=None, country=None, region=None, district=None, 
                          county=None, subcounty=None, parish=None, altitude=None, aspect=None, landform_90=None, landform_270=None, 
                          distance_from_nearest_road=None, distance_from_motorway=None, distance_from_residential=None, 
                          distance_from_city=None):
        '''
        Saves a new location into the database
        '''
        location_dict = {'loc_ref': loc_ref, 'host': host_name, 'mobility': mobility, 'latitude': latitude, 'longitude': longitude,
                         'road_intensity': road_intensity, 'description': description, 'road_status': road_status, 
                         'local_activities': local_activities, 'location_name': loc_name, 'country': country, 'region': region, 
                         'district': district, 'county': county, 'subcounty': subcounty, 'parish': parish, 'altitude': altitude, 'aspect': aspect,
                         'landform_90': landform_90, 'landform_270': landform_270, 'distance_from_nearest_road': distance_from_nearest_road,
                         'distance_from_motorway': distance_from_motorway, 'distance_from_residential': distance_from_residential,
                         'distance_from_city': distance_from_city}

        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        db.location_registry.insert_one(location_dict)

    def all_locations(self):
        '''
        Gets specific fields of all locations to be displayed
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        query = {}
        projection = {'_id': 0, 'loc_ref': 1, 'location_name': 1, 'mobility': 1, 'latitude': 1, 'longitude': 1, 'country': 1, 'region': 1,
                      'district': 1, 'county': 1, 'subcounty': 1, 'parish': 1, 'description': 1}
        records = list(db.location_registry.find(query, projection))
        return records

    def get_location(self, loc_ref):
        '''
        Gets all the data in the database for a specific location
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        query = {'loc_ref': loc_ref}
        projection = {'_id': 0}
        records = list(db.location_registry.find(query, projection))
        return records[0]

    def get_location_details_to_edit(self, loc_ref):
        '''
        Gets all the data in the database for a specific location
        '''
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        query = {'loc_ref': loc_ref}
        projection = {'_id': 0, 'loc_ref': 1, 'host': 1, 'mobility': 1, 'latitude': 1, 'longitude': 1, 'road_intensity': 1, 
                      'description': 1, 'road_status': 1, 'local_activities': 1}
        records = list(db.location_registry.find(query, projection))
        try:
            revised_activities = []
            for activity in records[0]['local_activities']:
                revised_activities.append(
                    {'value': activity, 'label': activity})
            records[0]['local_activities'] = revised_activities
            return records[0]
        except:
            return records[0]

    def save_edited_location(self, loc_ref, road_intensity, description, road_status, local_activities):
        '''
        Saves updated location details to database
        '''

        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        db.location_registry.update_one(
            {'loc_ref': loc_ref},
            {'$set':
                {
                    'road_intensity': road_intensity,
                    'description': description,
                    'road_status': road_status,
                    'local_activities': local_activities
                }
             }
        )