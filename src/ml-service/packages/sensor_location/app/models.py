import geopandas as gpd
from shapely.ops import cascaded_union
from shapely import wkt
from shapely.geometry import Point
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
import clhs as cl
from flask import jsonify
import json
import controllers

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


