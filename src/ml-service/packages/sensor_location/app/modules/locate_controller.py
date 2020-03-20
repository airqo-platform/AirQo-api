import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.cluster import KMeans
import clhs as cl
import json
from flask import jsonify


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
    '''
    Splits data into training and test sets
    '''

    return train_test_split(X, y, test_size=0.3, shuffle=True)

def kmeans(data, sensor_number):
    '''
    Clustering data using K-Means Model
    '''
    kmeans = KMeans(n_clusters=sensor_number).fit(data) 
    y_kmeans = kmeans.fit_predict(data)
    return y_kmeans

def clhs(data, sensor_number):
    '''
    Using conditioned latin hyoercube sampling
    '''
    sampled = cl.clhs(data, sensor_number, max_iterations=1000)
    clhs_samples =data.iloc[sampled['sample_indices']]
    return clhs_samples

def random(data, sensor_number):
    '''
    Using random sampling
    '''
    random_samples = data.sample(sensor_number)
    data = random_samples[['parish', 'long', 'lat']]
    jsonfiles = json.loads(data.to_json(orient='records'))
    return jsonify(jsonfiles)