import geopandas as gpd
from shapely.ops import cascaded_union
from shapely import wkt
from shapely.geometry import Point
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.cluster import KMeans
import json
from pymongo import MongoClient

def process_data(data):
    #dropping columns with _pc in their names
    for column in data.columns:
        if '_pc' in column:
            data.drop(column, axis = 1, inplace = True)
    
    #Renaming some columns for better understandability
    data.rename(columns = {'d': 'district', 's': 'subcounty', 'p':'parish', 'pop':'population', 'hhs':'households'}, inplace = True)
    
    #Drop rows with null values
    data.dropna(axis=0, inplace=True)
    data = data.reset_index(drop=True)

    #extracting x, y and z coordinates to replace latitude and longitude 
    data['coord_x'] = np.cos(data['lat']) * np.cos(data['long'])
    data['coord_y'] = np.cos(data['lat']) * np.sin(data['long'])
    data['coord_z'] = np.sin(data['lat'])
    return data


def scaling(data):
    '''
    Normalizes data
    '''
    data = StandardScaler().fit_transform(data)
    return data

def split_data(X, y):
    return train_test_split(X, y, test_size=0.3, shuffle=True)

def connect_mongo(db_name):
    '''
    Connects to local MongoDB
    '''
    client = MongoClient("mongodb://localhost:27017/")
    print('Connected successfully!')
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
        db.kampala.insert_one(i)
    
    #db.collection_name.insert_many(payload)

def mongo2df(db_name, collection_name):
    ''' 
    Retrieves data from mongodb to a dataframe
    '''
    db = connect_mongo(db_name)
    print (db[collection_name].count_documents({}))
    
    df = pd.DataFrame(list(db.collection_name.find()))
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
    Read from Mongo and Store into DataFrame 
    """
    
    db = connect_mongo(db_name)
    cursor = db.collection_name.find(query)  
    df =  pd.DataFrame(list(cursor))
    if no_id:
        del df['_id']
    return df


    

    
    


    