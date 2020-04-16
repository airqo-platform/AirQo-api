import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_samples, silhouette_score
from pandas.io.json import json_normalize
import json


def json_to_df(json_list):
    '''
    converts json records to normalized dataframe
    '''
    return json_normalize(json_list)

def process_data(data):
    '''
    preprocesses geocensus data
    '''
    
    data.dropna(axis=0, inplace=True)
    data = data.reset_index(drop=True)
    return data

def silhouette(X):
    '''
    determines the optimal number of clusters using silhouette score
    '''
    silhouette_avgs = {}
    n_clusters = [x for x in range(2, X.shape[0]-1)]
    for n in n_clusters:

        clusterer = KMeans(n_clusters=n, random_state=10)
        cluster_labels = clusterer.fit_predict(X)

        silhouette_avg = silhouette_score(X, cluster_labels)
        silhouette_avgs[n] = silhouette_avg
    key_max = max(silhouette_avgs.keys(), key=(lambda k: silhouette_avgs[k]))
    return key_max

def scaling(data):
    '''
    Normalizes data
    '''
    scaled_data = StandardScaler().fit_transform(data)
    return scaled_data

def kmeans_algorithm(data, sensor_number=None):
    '''
    Clustering data using K-Means Model
    '''
    if sensor_number == None:
        sensor_number = silhouette(data)
    
    X = data[['properties.lat', 'properties.long', 'properties.population_density', 'properties.household_density', 
              'properties.charcoal_per_km2', 'properties.firewood_per_km2', 'properties.cowdung_per_km2', 
              'properties.grass_per_km2', 'properties.wasteburning_per_km2', 'properties.kitch_outsidebuilt_per_km2',
              'properties.kitch_makeshift_per_km2', 'properties.kitch_openspace_per_km2']]
    
    X_scaled = scaling(X)    
    
    kmeans = KMeans(n_clusters=sensor_number).fit(X_scaled) 
    y_kmeans = kmeans.fit_predict(X_scaled)
    
    data_copy = data.copy()
    
    data_copy['cluster'] = y_kmeans
    
    kmeans_samples = data_copy.sample(frac=1).reset_index(drop=True)
    kmeans_samples= kmeans_samples.drop_duplicates('cluster', keep = 'last')
    kmeans_samples = kmeans_samples[['properties.district', 'properties.subcounty', 'properties.parish', 
                                     'geometry.coordinates']]
    
    return json.loads(kmeans_samples.to_json(orient = 'records'))


def get_data(data):
 """
 This function deserializes an JSON object.

:param data: JSON data
 :type data: str
 """
 json_data = json.loads(data)
 print("Deserialized data: {}".format(data))
 return json_data


