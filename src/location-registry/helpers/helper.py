from pymongo import MongoClient
import pymongo
import os
import ee
import osmnx as ox
import pyproj
import requests
from shapely.geometry import Point
from shapely.ops import transform
from geopy.distance import distance

MONGO_URI = os.getenv("MONGO_URI")
API_KEY = os.getenv("API_KEY")
OVERPASS_URL = os.getenv("OVERPASS_URL")

ee.Initialize()

def connect_mongo():
    '''
    Connects to MongoDB
    '''
    try:
        client = MongoClient(MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        print("Could not connect to MongoDB: %s" % e)

    #db = client['locate']
    db = client['geocensus_db']
    return db


def get_location_ref():
    '''
    Generates location reference
    '''
    db = connect_mongo()
    last_document = list(db.locations.find({}).sort([('_id', -1)]).limit(1))
    #last_document = list(db.collection.find({}).limit(1).sort([('$natural',-1)])
    if len(last_document)==0:
        loc_ref =1
    else:
        ref = last_document[0]['loc_ref']
        loc_ref = int(ref[4:])+1
        
    return 'loc_'+str(loc_ref)

def get_location_details(lon, lat):
    '''
    Gets the location details for the coordinates
    '''
    query = {
        'geometry': {
            '$geoIntersects': {
                '$geometry': {
                    'type': 'Point' ,
                    'coordinates': [lon, lat]
                }
            }
        }
    }
    
    projection = {
        '_id': 0, 
        'properties.region':1, 
        'properties.district':1, 
        'properties.county':1,
        'properties.subcounty':1,
        'properties.parish':1
    }
    db = connect_mongo()
    records = list(db.geometry_polygon.find(query, projection))
    region = records[0]['properties']['region']
    district = records[0]['properties']['district']
    county = records[0]['properties']['county']
    subcounty = records[0]['properties']['subcounty']
    parish = records[0]['properties']['parish']
    return region, district.lower(), county.lower(), subcounty.lower(), parish.lower()

def get_location_name(parish, district):
    '''
    Generates the display name for the location
    '''
    return parish+", "+district

def get_altitude(lat,lon):
    '''
    Returns the altitude at the specified coordinates
    '''
    url = 'https://maps.googleapis.com/maps/api/elevation/json?locations={0},{1}&key={2}'.format(lat,lon, API_KEY)
    
    response = requests.get(url).json()
    return response['results'][0]['elevation']

def get_landform90(lat, lon):
    '''
    Returns the topography score of a location over a 90m range
    '''
   # constant_dict = {11:'Peak/ridge (warm)', 12:'Peak/ridge', 13:'Peak/ridge (cool)',14:'Mountain/divide', 15:'Cliff', 
    #                 21:'Upper slope (warm)', 22:'Upper slope',23:'Upper slope (cool)',24:'Upper slope (flat)', 
     #                31:'Lower slope (warm)', 32:'Lower slope', 33:'Lower slope (cool)', 34:'Lower slope (flat)', 
      #               41:'Valley', 42:'Valley (narrow)' }
    image = ee.Image('CSP/ERGo/1_0/Global/ALOS_landforms')
    point = ee.Geometry.Point(lon, lat)
    data = image.select('constant').reduceRegion(ee.Reducer.first(), point, 1).get('constant')
    land_value = data.getInfo()
    #return constant_dict[land_value]
    return land_value

def get_landform270(lat, lon):
    '''
    Returns the topography score of a location over a 270m range
    '''
    image = ee.Image("CSP/ERGo/1_0/Global/ALOS_mTPI") 
    point = ee.Geometry.Point(lon, lat)
    data = image.select('AVE').reduceRegion(ee.Reducer.first(), point, 1).get('AVE')
    return data.getInfo()

def distance_to_closest_road(lat, lon):
    '''
    Returns the distance in metres from the nearest road - 1km radius
    '''
    try:

        G = ox.graph_from_point((lat,lon), dist=1000, network_type='drive')
        gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
        gdf.to_crs(epsg=3310, inplace=True)
        
        #convert point to utm in order to get distance in metres
        wgs84_pt = Point(lon, lat)
        wgs84 = pyproj.CRS('EPSG:4326')
        utm = pyproj.CRS('EPSG:3310')
        project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
        utm_point = transform(project, wgs84_pt)
    
    
        roads = gdf[['geometry', 'u', 'v','highway']].values.tolist()
        roads_with_distances = [(road, utm_point.distance(road[0])) for road in roads]
        roads_with_distances = sorted(roads_with_distances, key=lambda x: x[1])
        closest_road = roads_with_distances[0]
        closest_distance = closest_road[1]
        closest_road_type = closest_road[0][3]
        
        residential_gdf =  gdf[gdf['highway'] == 'residential']
        if residential_gdf.shape[0]==0:
            closest_residential_distance = None
        else:
            residential_roads = residential_gdf[['geometry', 'u', 'v']].values.tolist()
            residential_roads_with_distances = [(road, utm_point.distance(road[0])) for road in residential_roads]
            residential_roads_with_distances = sorted(residential_roads_with_distances, key=lambda x: x[1])
            closest_residential_road = residential_roads_with_distances[0]
            closest_residential_distance = closest_residential_road[1]
    except:
        closest_road_type=None
        closest_distance=None
        closest_residential_distance=None
    
    return closest_road_type, closest_distance, closest_residential_distance

def distance_to_closest_motorway(lat, lon):
    '''
    Returns the distance in metres from the nearest motorway - 10km radius
    '''
    try:
        G = ox.graph_from_point((lat,lon), dist=10000, network_type='drive')
        gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
        gdf.to_crs(epsg=3310, inplace=True)
        new_gdf = gdf[gdf['highway'] == 'motorway']
    
        if new_gdf.shape[0]==0:
            closest_distance=None
        else:  
            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)
    
            roads = new_gdf[['geometry', 'u', 'v']].values.tolist()
            roads_with_distances = [(road, utm_point.distance(road[0])) for road in roads]
            roads_with_distances = sorted(roads_with_distances, key=lambda x: x[1])
            closest_road = roads_with_distances[0]
            closest_distance = closest_road[1]
    except:
        closest_distance = None
    return closest_distance

def distance_to_nearest_city(lat,lon):
    '''
    Calculates distance to nearest city/town in metres
    '''
    city_query = '''
    [out:json][timeout:25];
    (
    node['place'='city'](around:50000.0, {0},{1});
    );
    out;
    '''.format(lat, lon) 
    response = requests.get(OVERPASS_URL, params={'data': city_query})
    data = response.json()
    if len(data['elements'])>0:
        for element in data['elements']:
            element_lat = element['lat']
            element_long = element['lon']
        
            point =(lon,lat)
            element_point= (element_long,element_lat)
            element_distance = distance(point, element_point).km
            element['distance'] = element_distance         
            
        element_list = sorted([x for x in data['elements']], key=lambda x: x['distance'])
        return element_list[0]['distance']*1000
    else:
        return None

def register_location(loc_ref, host_name, mobility=None, longitude=None, latitude=None, internet=None, power=None,
                     height=None, road_intensity=None, installation_type=None, road_status=None, landuse=None,
                     loc_name=None, country=None, region=None, district=None, county=None, subcounty=None,
                     parish=None, altitude=None, aspect=None, landform_90=None, landform_270=None, distance_from_nearest_road=None,
                     distance_from_motorway=None, distance_from_residential=None, distance_from_city=None):
    '''
    Saves a new location into the database
    '''
    location_dict = {'loc_ref':loc_ref, 'host':host_name,'mobility':mobility,'latitude':latitude, 'longitude':longitude,
    'internet':internet, 'power':power, 'height_above_ground':height,'road_intensity':road_intensity, 
    'installation_type':installation_type, 'road_status':road_status, 'landuse':landuse, 'location_name':loc_name, 'country':country, 
    'region':region, 'district':district, 'county':county, 'subcounty':subcounty, 'parish':parish, 'altitude':altitude, 'aspect':aspect,
    'landform_90':landform_90, 'landform_270':landform_270, 'distance_from_nearest_road':distance_from_nearest_road, 
    'distance_from_motorway':distance_from_motorway, 'distance_from_residential':distance_from_residential, 
    'distance_from_city': distance_from_city}

    db = connect_mongo()
    db.locations.insert_one(location_dict)

def all_locations():
    '''
    Gets specific fields of all locations to be displayed
    '''
    db = connect_mongo()
    query = {}
    projection = {'_id': 0, 'loc_ref':1, 'location_name':1, 'host':1, 'latitude':1, 'longitude':1, 'country':1, 'region':1,
              'district':1, 'county':1, 'subcounty':1, 'parish':1}
    records = list(db.locations.find(query, projection))
    return records

def get_location(loc_ref):
    '''
    Gets all the data in the database for a specific location
    '''
    db = connect_mongo()
    query = {'loc_ref':loc_ref}
    projection = {'_id':0}
    records = list(db.locations.find(query, projection))
    return records[0]

def get_location_details_to_edit(loc_ref):
    '''
    Gets all the data in the database for a specific location
    '''
    db = connect_mongo()
    query = {'loc_ref':loc_ref}
    projection = {'_id':0, 'loc_ref':1, 'host':1, 'mobility':1, 'latitude':1, 'longitude':1, 'internet':1, 'power':1,
    'height_above_ground':1, 'road_intensity':1, 'installation_type':1, 'road_status':1, 'landuse':1}
    records = list(db.locations.find(query, projection))
    return records[0]
    

def save_edited_location(loc_ref, power, internet, height, road_intensity, installation_type, road_status, landuse):    
    '''
    Saves updated location details to database'''
    db=connect_mongo()
    db.locations.update_one(
       { 'loc_ref': loc_ref },
       { '$set':
          {
            'power': power,
            'internet': internet,
            'height_above_ground':height,
            'road_intensity': road_intensity,
            'installation_type': installation_type,
            'road_status': road_status,
            'landuse':landuse
          }
       }
    )