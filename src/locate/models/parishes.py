import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import sys
from helpers import helper

MONGO_URI = os.getenv('MONGO_URI')

class Parish():
    '''
    The class handles functionality for accessing data for the parishes.
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    '''

    def __init__(self):
        ''' initialize ''' 


    def get_parishes_map(self, polygon):
        '''
        Gets all the parishes in a given polygon
        '''
        if polygon == None:
            return 'Please select a polygon'
        else:
            try:
                query = {
                    'geometry': {
                        '$geoWithin': {
                            '$geometry': {
                                'type': 'Polygon',
                                'coordinates': polygon
                                }
                                }
                                }
                                }
                projection = {'_id': 0}

                client = MongoClient(MONGO_URI)
                db = client['airqo_netmanager']
                records = db.locate.find(query, projection)
                records_list = list(records)
                return records_list
            except:
                return 'Invalid polygon'

    def get_parish_for_point(self, point):
        '''
        Gets the parish in which the given coordinates belong
        '''
        query = {
            'geometry': {
                '$geoIntersects': {
                    '$geometry': {
                        'type': 'Point',
                        'coordinates': point
                    }
                }
            }
        }
        projection = {'_id': 0}
        client = MongoClient(MONGO_URI)
        db = client['airqo_netmanager']
        records = db.locate.find(query, projection)
        records_list = list(records)
        return records_list