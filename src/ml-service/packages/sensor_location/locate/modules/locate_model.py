import pandas as pd
from pymongo import MongoClient
import pymongo
import json

def connect_mongo():
    '''
    Connects to MongoDB
    '''
    try:    
        #client = MongoClient('mongodb+srv://lillian:fosho@cluster0-99jha.gcp.mongodb.net/test?retryWrites=true&w=majority')
        client = MongoClient("mongodb://localhost:27017")
    except pymongo.errors.ConnectionFailure as e:
        print("Could not connect to MongoDB: %s" % e)
    
    #db = client['locate']
    db = client['geocensus_db']
    return db

def csv2mongo(csv_path):
    '''
    Imports csv file into a geo_census collection in MongoDB
    '''
    db = connect_mongo()
    data=pd.read_csv(csv_path)
    payload=json.loads(data.to_json(orient='records'))

    for i in payload:
        #db['geo_census'].insert_one(i)
        db['kampala'].insert_one(i)

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
    #records = db.geo_census.find(query, projection)
    records = db.kampala.find(query, projection)
    
    return list(records)


def get_parishes_map(polygon):
    '''
    Gets all the parishes in a given district and/or subcounty
    '''
    if polygon == None:
        return 'Please select a polygon'
    else:
        query = {
            'geometry': {
                '$geoWithin': {
                    '$geometry': {
                        'type': 'Polygon' ,
                        'coordinates': [[[ 32.506, 0.314], [32.577, 0.389], [32.609, 0.392], [32.641, 0.362], 
                                         [32.582, 0.266], [32.506, 0.314]]]
                    }
                }
            }
        }
    
        projection = { '_id': 0}
    
        db = connect_mongo()
        records = db.geometry_polygon.find(query, projection)
        return list(records)


    

    
    


    

