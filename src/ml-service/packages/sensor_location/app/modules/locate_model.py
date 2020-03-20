import pandas as pd
from pymongo import MongoClient
from flask import jsonify
import json

def connect_mongo(db_name):
    '''
    Connects to local MongoDB
    '''
    client = MongoClient("mongodb://localhost:27017/")
    db = client[db_name]
    return db

#Function that imports csv files into a Mongo database
def csv2mongo(csv_path, db_name, collection_name):
    '''
    Imports csv file into a Mongo database
    '''
    db = connect_mongo(db_name)
    data=pd.read_csv(csv_path)
    payload=json.loads(data.to_json(orient='records'))

    for i in payload:
        db[collection_name].insert_one(i)
    
    #db.collection_name.insert_many(payload)

def mongo2df(db_name, collection_name):
    ''' 
    Retrieves data from mongodb to a dataframe
    '''
    db = connect_mongo(db_name)
    
    df = pd.DataFrame(list(db[collection_name].find()))
    return df

def df2mongo(df, db_name, collection_name):
    '''
    imports data from dataframe to MongoDB
    '''
    db = connect_mongo(db_name)
    
    records = json.loads(df.T.to_json()).values()
    db.collection_name.insert_many(records)

def read_mongo(db_name, collection_name, query={}, no_id=True):
    """ 
    Read from Mongo and store into DataFrame 
    """
    
    db = connect_mongo(db_name)
    cursor = db.collection_name.find(query)  
    df =  pd.DataFrame(list(cursor))
    if no_id:
        del df['_id']
    return df


    

    
    


    

