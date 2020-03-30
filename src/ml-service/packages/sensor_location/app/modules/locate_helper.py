import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_samples, silhouette_score


def json_to_df(json_list):
    '''
    converts json records to dataframe
    '''
    return pd.DataFrame.from_records(json_list)

def process_data(data):
    '''
    preprocesses geocensus data
    '''
    for column in data.columns:
        if '_pc' in column:
            data.drop(column, axis = 1, inplace = True)
    
    data.rename(columns = {'d': 'district', 's': 'subcounty', 'p':'parish', 'pop':'population', 'hhs':'households'}, inplace = True)
    
    data.dropna(axis=0, inplace=True)
    data = data.reset_index(drop=True)

    data['coord_x'] = np.cos(data['lat']) * np.cos(data['long'])
    data['coord_y'] = np.cos(data['lat']) * np.sin(data['long'])
    data['coord_z'] = np.sin(data['lat'])
    return data

def silhouette(data):
    '''
    determines the optimal number of clusters using silhouette score
    '''
    silhouette_avgs = {}
    data
    n_clusters = [x for x in range(2, data.shape[0]-1)]
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
    
    X = data[['light_par_tadooba_per_km', 'light_firewood_per_km', 'light_cow_dung_per_km', 'light_grass_per_km', 
          'cook_charc_per_km', 'cook_firewood_per_km', 'cook_dung_per_km', 'cook_grass_per_km', 'waste_burn_per_km',
          'kitch_outside_built_per_km', 'kitch_make_shift_per_km', 'kitch_open_space_per_km', 'pop_density', 
          'hhs_density', 'T123_per_sqkm']]
    
    X_scaled = scaling(X)    
    kmeans = KMeans(n_clusters=sensor_number).fit(X_scaled) 
    y_kmeans = kmeans.fit_predict(X_scaled)
    
    data_copy = data.copy()
    
    data_copy['cluster'] = y_kmeans
    
    kmeans_samples = data_copy.sample(frac=1).reset_index(drop=True)
    kmeans_samples= kmeans_samples.drop_duplicates('cluster', keep = 'last')
    kmeans_samples = kmeans_samples[['parish', 'centroid']]
    
    return kmeans_samples.to_json(orient = 'records')


