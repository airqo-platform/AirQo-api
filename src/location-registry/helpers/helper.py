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
import app
from dotenv import load_dotenv
load_dotenv()

#MONGO_URI = os.getenv("MONGO_URI")
API_KEY = os.getenv("API_KEY")
OVERPASS_URL = os.getenv("OVERPASS_URL")
SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT")  # +

credentials = ee.ServiceAccountCredentials(
    SERVICE_ACCOUNT, 'private_key.json')  # +

if os.getenv('FLASK_ENV') == 'production':
    MONGO_URI = os.getenv('PROD_MONGO_URI')
elif os.getenv('FLASK_ENV') == 'testing':
    MONGO_URI = os.getenv('PROD_MONGO_URI')
else:
    MONGO_URI = os.getenv('DEV_MONGO_URI')


ee.Initialize(credentials)
# ee.Initialize()


def connect_mongo(tenant_id):
    '''
    Connects to MongoDB
    '''
    try:
        client = MongoClient(MONGO_URI)
    except pymongo.errors.ConnectionFailure as e:
        return {'message':'unable to connect to database', 'sucess':False}, 400
    db_name = 'airqo_netmanager_'+tenant_id
    db = client[db_name]
    return db


def get_location_ref(tenant_id):
    '''
    Generates location reference
    '''
    db = connect_mongo(tenant_id)
    last_document = list(db.location_registry.find(
        {}).sort([('_id', -1)]).limit(1))
    if len(last_document) == 0:
        loc_ref = 1
    else:
        ref = last_document[0]['loc_ref']
        try: 
            loc_ref = int(ref[4:])+1
            return 'loc_'+str(loc_ref)
        except:
            return {'message': 'Invalid input'}, 400

    

def get_location_details(lon, lat, tenant_id):
    '''
    Gets the location details for the coordinates
    '''
    query = {
        'geometry': {
            '$geoIntersects': {
                '$geometry': {
                    'type': 'Point',
                    'coordinates': [lon, lat]
                }
            }
        }
    }

    projection = {
        '_id': 0,
        'properties.Region': 1,
        'properties.District': 1,
        'properties.County': 1,
        'properties.Subcounty': 1,
        'properties.Parish': 1
    }
    db = connect_mongo(tenant_id)
    records = list(db.locate_map.find(query, projection))
    region = records[0]['properties']['Region']
    district = records[0]['properties']['District']
    county = records[0]['properties']['County']
    subcounty = records[0]['properties']['Subcounty']
    parish = records[0]['properties']['Parish']
    return region.capitalize(), district.capitalize(), county.capitalize(), subcounty.capitalize(), parish.capitalize()


def get_location_name(parish, district):
    '''
    Generates the display name for the location
    '''
    return parish+", "+district


def get_altitude(lat, lon):
    '''
    Returns the altitude at the specified coordinates
    '''
    url = 'https://maps.googleapis.com/maps/api/elevation/json?locations={0},{1}&key={2}'.format(
        lat, lon, API_KEY)

    response = requests.get(url).json()
    altitude = response['results'][0]['elevation']
    return round(altitude, 2)


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
    data = image.select('constant').reduceRegion(
        ee.Reducer.first(), point, 1).get('constant')
    land_value = data.getInfo()
    # return constant_dict[land_value]
    return land_value


def get_landform270(lat, lon):
    '''
    Returns the topography score  and aspect of a location over a 270m range
    '''
    image = ee.Image("CSP/ERGo/1_0/Global/ALOS_mTPI")
    point = ee.Geometry.Point(lon, lat)
    landform_data = image.select('AVE').reduceRegion(
        ee.Reducer.first(), point, 1).get('AVE')

    aspect = ee.Terrain.aspect(image)
    aspect_data = aspect.select('aspect').reduceRegion(
        ee.Reducer.first(), point, 1).get('aspect')
    return landform_data.getInfo(), round(aspect_data.getInfo(), 2)


def distance_to_closest_road(lat, lon):
    '''
    Returns the distance in metres from the nearest road - 1km radius
    '''
    try:

        G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
        gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
        gdf.to_crs(epsg=3310, inplace=True)

        # convert point to utm in order to get distance in metres
        wgs84_pt = Point(lon, lat)
        wgs84 = pyproj.CRS('EPSG:4326')
        utm = pyproj.CRS('EPSG:3310')
        project = pyproj.Transformer.from_crs(
            wgs84, utm, always_xy=True).transform
        utm_point = transform(project, wgs84_pt)

        roads = gdf[['geometry', 'u', 'v', 'highway']].values.tolist()
        roads_with_distances = [
            (road, utm_point.distance(road[0])) for road in roads]
        roads_with_distances = sorted(roads_with_distances, key=lambda x: x[1])
        closest_road = roads_with_distances[0]
        closest_distance = round(closest_road[1], 2)
        closest_road_type = closest_road[0][3]

        residential_gdf = gdf[gdf['highway'] == 'residential']
        if residential_gdf.shape[0] == 0:
            closest_residential_distance = None
        else:
            residential_roads = residential_gdf[[
                'geometry', 'u', 'v']].values.tolist()
            residential_roads_with_distances = [
                (road, utm_point.distance(road[0])) for road in residential_roads]
            residential_roads_with_distances = sorted(
                residential_roads_with_distances, key=lambda x: x[1])
            closest_residential_road = residential_roads_with_distances[0]
            closest_residential_distance = round(
                closest_residential_road[1], 2)
    except:
        closest_road_type = None
        closest_distance = None
        closest_residential_distance = None

    return closest_road_type, closest_distance, closest_residential_distance


def distance_to_closest_motorway(lat, lon):
    '''
    Returns the distance in metres from the nearest motorway - 10km radius
    '''
    try:
        G = ox.graph_from_point((lat, lon), dist=10000, network_type='drive')
        gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
        gdf.to_crs(epsg=3310, inplace=True)
        new_gdf = gdf[gdf['highway'] == 'motorway']

        if new_gdf.shape[0] == 0:
            closest_distance = None
        else:
            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(
                wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)

            roads = new_gdf[['geometry', 'u', 'v']].values.tolist()
            roads_with_distances = [
                (road, utm_point.distance(road[0])) for road in roads]
            roads_with_distances = sorted(
                roads_with_distances, key=lambda x: x[1])
            closest_road = roads_with_distances[0]
            closest_distance = round(closest_road[1], 2)
    except:
        closest_distance = None
    return closest_distance


def distance_to_nearest_city(lat, lon):
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
    if len(data['elements']) > 0:
        for element in data['elements']:
            element_lat = element['lat']
            element_long = element['lon']

            point = (lon, lat)
            element_point = (element_long, element_lat)
            element_distance = distance(point, element_point).km
            element['distance'] = element_distance

        element_list = sorted([x for x in data['elements']],
                              key=lambda x: x['distance'])
        city_distance = element_list[0]['distance']*1000
        return round(city_distance, 2)
    else:
        return None