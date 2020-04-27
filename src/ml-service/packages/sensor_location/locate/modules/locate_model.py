import pandas as pd
from pymongo import MongoClient
import pymongo
import json
import os

MONGO_URI = os.getenv('MONGO_URI')

def connect_mongo():
    '''
    Connects to MongoDB
    '''
    try:    
        client = MongoClient(MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        print("Could not connect to MongoDB: %s" % e)
    
    db = client['locate']
    return db

def csv2mongo(csv_path, collection):
    '''
    Imports csv file into a geo_census collection in MongoDB
    '''
    db = connect_mongo()
    data=pd.read_csv(csv_path)
    payload=json.loads(data.to_json(orient='records'))

    for i in payload:
        db[collection].insert_one(i)
       

def get_parishes(district, subcounty=None):
    '''
    Gets all the parishes in a given district and/or subcounty
    '''
    if subcounty == None:
        query = {'d': district}
    else:
        query = {'d':district, 's':subcounty}
    
    projection = { '_id': 0}
    
    db = connect_mongo()
    records = db.geo_census.find(query, projection)
    
    return list(records)


def get_parishes_map(polygon):
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
                            'type': 'Polygon' ,
                            'coordinates': polygon
                    }
                }
            }}
            
            projection = { '_id': 0}
    
            db = connect_mongo()
            records = db.geometry_polygon.find(query, projection)
            return list(records)
        except:
            return 'Invalid polygon'

def get_parish_for_point(point):
    '''
    Gets the parish in which the given coordinates belong
    '''
    query = {
        'geometry': {
            '$geoIntersects': {
                '$geometry': {
                    'type': 'Point' ,
                    'coordinates': point
                }
            }
        }
    }
    
    projection = { '_id': 0 }
    db = connect_mongo()
    records = db.geometry_polygon.find(query, projection)
    return list(records)


    
    


    

