import pandas as pd
from pymongo import MongoClient
import json

def connect_mongo():
    '''
    Connects to local MongoDB
    '''
    #client = MongoClient('mongodb+srv://lillian:fosho@cluster0-99jha.gcp.mongodb.net/test?retryWrites=true&w=majority')
    client = MongoClient("mongodb://localhost:27017")
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


    

    
    


    

