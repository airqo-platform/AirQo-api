import os
import ee 
import osmnx as ox
import pyproj
import requests
from shapely.geometry import Point
from shapely.ops import transform
import json
from dotenv import load_dotenv
from geopy import distance
from  models import TAHMO
import pandas as pd

load_dotenv()

TAHMO_API_CREDENTIALS_USERNAME = os.getenv("TAHMO_API_CREDENTIALS_USERNAME")
TAHMO_API_CREDENTIALS_PASSWORD = os.getenv("TAHMO_API_CREDENTIALS_PASSWORD")
DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
ELEVATION_BASE_URL = os.getenv("ELEVATION_BASE_URL")
GOOGLE_MAP_API_KEY = os.getenv("GOOGLE_MAP_API_KEY")
WEATHER_STATION_AIRQUALITY_SITE_DISTANCE_THRESHOLD = os.getenv("WEATHER_STATION_AIRQUALITY_SITE_DISTANCE_THRESHOLD")
CENTER_OF_KAMPALA_LATITUDE = os.getenv("CENTER_OF_KAMPALA_LATITUDE")
CENTER_OF_KAMPALA_LONGITUDE =os.getenv("CENTER_OF_KAMPALA_LONGITUDE")
SERVICE_ACCOUNT = os.getenv("SERVICE_ACCOUNT") 

credentials = ee.ServiceAccountCredentials(SERVICE_ACCOUNT, "private_key.json") 

ee.Initialize(credentials)

class  Extract():

         
    def get_greenness(self,lat, lon, start_date, end_date):
        '''
         Gets & returns the average greenness value at the specified coordinates
         for the specified time  period
        '''
        greenness=''
        dataset = ee.ImageCollection('MODIS/006/MOD13Q1').filter(ee.Filter.date(start_date, end_date)).mean()
        location_geometry = ee.Geometry.Point(lon, lat)
        greennessDict = dataset.reduceRegion(ee.Reducer.mean(), location_geometry, 90)
        meanGreenness =  greennessDict.get('NDVI')
        greenness = meanGreenness.getInfo()
        return greenness

    def get_landuse(self,lat, lon):
        '''
         Gets & returns the landuses at the specified coordinates
        '''
        useful_tags_path = ['bridge', 'tunnel', 'oneway', 'lanes', 'ref', 'name',
                    'highway', 'maxspeed', 'service', 'access', 'area',
                    'landuse', 'width', 'est_width', 'junction', 'surface']
        ox.utils.config(useful_tags_way=useful_tags_path)        
        tags = {"amenity": True, "landuse": True}        
        G = ox.graph_from_point((lat, lon), dist=10000, network_type='drive')
        gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
             
        return gdf


    def get_altitude(self,lat, lon):
        '''
        Returns the altitude at the specified coordinates
        '''
        url = ELEVATION_BASE_URL + '?locations={0},{1}&key={2}'.format(lat, lon, GOOGLE_MAP_API_KEY)

        response = requests.get(url).json()
        altitude = response['results'][0]['elevation']
        return round(altitude, 2)

    def checkKey(self, dict, key):
        '''
        checks wether specified key is available in the specified dictionary.
        ''' 
        if key in dict.keys(): 
            return True 
        else: 
            return False

    def get_closest_weather_station(self, name, latitude,longitude):
        specified_coordinates = (latitude, longitude)
        weather_stations_with_distances_from_specified_coordinates = {}
        all_stations = self.get_all_weather_station_account_has_access_on()
        specified_coordinates = (latitude  , longitude)
        for key,station in all_stations.items():
            #print(station)          
            weather_station_coordinates = (station['location']['latitude'], station['location']['longitude'])
            #print(weather_station_coordinates)
            distance_between_coordinates = distance.distance(specified_coordinates, weather_station_coordinates).km
            weather_stations_with_distances_from_specified_coordinates[station["code"]]= distance_between_coordinates
        
        #print(weather_stations_with_distances_from_specified_coordinates)
        weather_station_with_min_distance= min(weather_stations_with_distances_from_specified_coordinates.keys(), key=(lambda k: weather_stations_with_distances_from_specified_coordinates[k]))
        selected_station={}
        print(type(weather_station_with_min_distance))
        print(weather_station_with_min_distance)

        if weather_stations_with_distances_from_specified_coordinates[weather_station_with_min_distance]:
            if weather_stations_with_distances_from_specified_coordinates[weather_station_with_min_distance] >= float(WEATHER_STATION_AIRQUALITY_SITE_DISTANCE_THRESHOLD):
                return weather_station_with_min_distance, selected_station
            else:
                selected_station = all_stations.get(weather_station_with_min_distance)
                #print(selected_station)
                return  weather_station_with_min_distance, selected_station
        else:
             return weather_station_with_min_distance, selected_station

    

    def get_all_weather_station_account_has_access_on(self):
        tahmo_api = TAHMO.apiWrapper()
        tahmo_api.setCredentials(TAHMO_API_CREDENTIALS_USERNAME, TAHMO_API_CREDENTIALS_PASSWORD)
        stations = tahmo_api.getStations()
        return stations


    def get_all_available_variables_and_units_tahmo_api(self):
        tahmo_api = TAHMO.apiWrapper()
        tahmo_api.setCredentials(TAHMO_API_CREDENTIALS_USERNAME, TAHMO_API_CREDENTIALS_PASSWORD)
        variables = tahmo_api.getVariables()
        print('Available variables in TAHMO API:')
        for variable in variables:
            print('%s [%s] with shortcode "%s"' %
            (variables[variable]['description'], variables[variable]['units'], variables[variable]['shortcode']))

    def get_station_measurements(self,station,startDate,endDate):
        tahmo_api = TAHMO.apiWrapper()
        tahmo_api.setCredentials(TAHMO_API_CREDENTIALS_USERNAME, TAHMO_API_CREDENTIALS_PASSWORD)
        df = tahmo_api.getMeasurements(station, startDate=startDate, endDate=endDate)
        df.index.name = 'Timestamp'
        #columns = ['Atmospheric pressure [kPa]','Precipitation','Relative humidity','Wind speed [m/s]','Wind gusts [m/s]','' ]
        #df.rename(columns={'ap':'Atmospheric pressure [kPa]','pr':'Precipitation', 'rh':'Relative humidity', 'ws':'Wind speed [m/s]','Wind gusts [m/s]'},inplace=True)
        #df.to_csv(station+'.csv', na_rep='', date_format='%Y-%m-%d %H:%M')
        return df
    
    
    def get_devices(self,name="",tenant="airqo"):
        if name=="":
            api_url = DEVICE_REGISTRY_BASE_URL + "devices?tenant="+tenant
        else:
            api_url =  DEVICE_REGISTRY_BASE_URL + "devices?tenant="+tenant + "&name="+name
        try:
            results = requests.get(api_url,verify=False)
            devices_data = results.json()["devices"]
        except Exception as ex:
            print("Devices Url returned an error : " + str(ex))
            devices_data = {}

        with open('device.json','w') as f:
            json.dump(list(devices_data), f)

        return devices_data


        
    def get_aspect_270(self, lat, lon):
        '''
        Returns the  aspect of a location over a 270m range
        '''
        image = ee.Image("CSP/ERGo/1_0/Global/ALOS_mTPI")
        point = ee.Geometry.Point(lon, lat)
        
        aspect = ee.Terrain.aspect(image)
        aspect_data = aspect.select('aspect').reduceRegion(
            ee.Reducer.first(), point, 1).get('aspect')
        return round(aspect_data.getInfo(), 2)
    
    def get_landform270(self, lat, lon):
        '''
        Returns the topography score of a location over a 270m range
        '''
        image = ee.Image("CSP/ERGo/1_0/Global/ALOS_mTPI")
        point = ee.Geometry.Point(lon, lat)
        landform_data = image.select('AVE').reduceRegion(
            ee.Reducer.first(), point, 1).get('AVE')        
        return landform_data.getInfo()
    
    def get_landform90(self, lat, lon):
        '''
        Returns the topography score of a location over a 90m range
        '''
        '''constant_dict = {11:'Peak/ridge (warm)', 12:'Peak/ridge', 13:'Peak/ridge (cool)',14:'Mountain/divide', 15:'Cliff',
                        21:'Upper slope (warm)', 22:'Upper slope',23:'Upper slope (cool)',24:'Upper slope (flat)',
                       31:'Lower slope (warm)', 32:'Lower slope', 33:'Lower slope (cool)', 34:'Lower slope (flat)',
                       41:'Valley', 42:'Valley (narrow)' }
        '''
        image = ee.Image('CSP/ERGo/1_0/Global/ALOS_landforms')
        point = ee.Geometry.Point(lon, lat)
        data = image.select('constant').reduceRegion(
            ee.Reducer.first(), point, 1).get('constant')
        land_value = data.getInfo()
        return land_value

    def get_bearing_from_kampala(self, lat, lon):
        KAMPALA_LAT = float(CENTER_OF_KAMPALA_LATITUDE)
        KAMPALA_LONG =float(CENTER_OF_KAMPALA_LONGITUDE)
        bearing = ox.bearing.calculate_bearing(KAMPALA_LAT, KAMPALA_LONG, lat,lon)
        return bearing

    def get_distance_from_kampala(self, lat, lon):
        KAMPALA_LAT = float(CENTER_OF_KAMPALA_LATITUDE)
        KAMPALA_LONG =float(CENTER_OF_KAMPALA_LONGITUDE)
        kamapla_coordinates = (KAMPALA_LAT, KAMPALA_LONG)        
        distance_from_kla = ox.distance.euclidean_dist_vec(KAMPALA_LONG, KAMPALA_LAT, lon,lat)
        distance_of_specified_coordinates_from_kla = distance.distance(kamapla_coordinates, (lat,lon)).km
        return distance_of_specified_coordinates_from_kla

    def get_distance_to_closest_motorway(self,lat, lon):
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
                roads_with_distances = [(road, utm_point.distance(road[0])) for road in roads]
                roads_with_distances = sorted(roads_with_distances, key=lambda x: x[1])
                closest_road = roads_with_distances[0]
                closest_distance = round(closest_road[1], 2)
        except:
            closest_distance = None
        return closest_distance


    def get_distance_to_closest_trunk(self,lat, lon):
        '''
        Returns the distance in metres from the nearest trunk road - 10km radius
        '''
        try:
            G = ox.graph_from_point((lat, lon), dist=30000, network_type='drive')
            gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
            gdf.to_crs(epsg=3310, inplace=True)
            new_gdf = gdf[gdf['highway'] == 'trunk']

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
                roads_with_distances = [(road, utm_point.distance(road[0])) for road in roads]
                roads_with_distances = sorted(roads_with_distances, key=lambda x: x[1])
                closest_road = roads_with_distances[0]
                closest_distance = round(closest_road[1], 2)
        except:
            closest_distance = None
        return closest_distance


    def get_distance_to_closest_road(self, lat, lon):
        '''
        Returns the distance in metres from the nearest road  - 1km radius
         i.e. closest road type, closest distance, 
        '''
        try:

            G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
            gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
            gdf.to_crs(epsg=3310, inplace=True)
            gdf = gdf.reset_index() ## to ensure the values of u & v are in the columns
            # convert point to utm in order to get distance in metres
            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)            
            roads = gdf[['geometry', 'u', 'v', 'highway']].values.tolist()
            roads_with_distances = [
                (road, utm_point.distance(road[0])) for road in roads]
            roads_with_distances = sorted(roads_with_distances, key=lambda x: x[1])
            closest_road = roads_with_distances[0]
            closest_distance = round(closest_road[1], 2)
            
        except Exception as ex: 
            #closest_road_type = None
            closest_distance = None           
            print(ex)
      
        return closest_distance
    
    def get_distance_to_closest_residential_road(self, lat, lon):
            '''
            Returns the distance in metres from the nearest residential roads  - 1km radius
            i.e closest_residential_distance
            '''
            try:

                G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
                gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
                gdf.to_crs(epsg=3310, inplace=True)
                gdf = gdf.reset_index() ## to ensure the values of u & v are in the columns
               
                # convert point to utm in order to get distance in metres
                wgs84_pt = Point(lon, lat)
                wgs84 = pyproj.CRS('EPSG:4326')
                utm = pyproj.CRS('EPSG:3310')
                project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
                utm_point = transform(project, wgs84_pt)            
                                
                residential_gdf = gdf[gdf['highway'] == 'residential']
                if residential_gdf.shape[0] == 0:
                    closest_residential_distance = None
                else:
                    residential_roads = residential_gdf[[
                        'geometry', 'u', 'v']].values.tolist()
                    residential_roads_with_distances = [(road, utm_point.distance(road[0])) for road in residential_roads]
                    residential_roads_with_distances = sorted(residential_roads_with_distances, key=lambda x: x[1])
                    closest_residential_road = residential_roads_with_distances[0]
                    closest_residential_distance = round(closest_residential_road[1], 2)
                
            except Exception as ex:                
                closest_residential_distance = None                
                print(ex)
        
            return  closest_residential_distance


    def get_distance_to_closest_tertiary_road(self, lat, lon):
        '''
        Returns the distance in metres from the nearest tertiary road  - 1km radius
         i.e.  closest_tertiary_distance,
        '''
        try:

            G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
            gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
            gdf.to_crs(epsg=3310, inplace=True)
            gdf = gdf.reset_index() ## to ensure the values of u & v are in the columns        

            # convert point to utm in order to get distance in metres
            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)          

            tertiary_gdf = gdf[gdf['highway'] == 'tertiary']
            if tertiary_gdf.shape[0] == 0:
                closest_tertiary_distance = None
            else:
                tertiary_roads = tertiary_gdf[[
                    'geometry', 'u', 'v']].values.tolist()
                tertiary_roads_with_distances = [
                    (road, utm_point.distance(road[0])) for road in tertiary_roads]
                tertiary_roads_with_distances = sorted(
                    tertiary_roads_with_distances, key=lambda x: x[1])
                closest_tertiary_road = tertiary_roads_with_distances[0]
                closest_tertiary_distance = round(closest_tertiary_road[1], 2)
           
        except Exception as ex: 
            closest_tertiary_distance = None           
            print(ex)
      
        return closest_tertiary_distance


    def get_distance_to_closest_unclassified_road(self, lat, lon):
        '''
        Returns the distance in metres from the nearest unclassified road  - 1km radius
         i.e.  closest_unclassified_distance,
        '''
        try:
            G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
            gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
            gdf.to_crs(epsg=3310, inplace=True)

            gdf = gdf.reset_index()        

            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)           

            unclassified_gdf = gdf[gdf['highway'] == 'unclassified']
            if unclassified_gdf.shape[0] == 0:
                closest_unclassified_distance = None
            else:
                unclassified_roads = unclassified_gdf[['geometry', 'u', 'v']].values.tolist()
                unclassified_roads_with_distances = [(road, utm_point.distance(road[0])) for road in unclassified_roads]
                unclassified_roads_with_distances = sorted(
                    unclassified_roads_with_distances, key=lambda x: x[1])
                closest_unclassified_road = unclassified_roads_with_distances[0]
                closest_unclassified_distance = round(closest_unclassified_road[1], 2)
                               
        except Exception as ex:                      
            closest_unclassified_distance = None
            print(ex)
      
        return closest_unclassified_distance



    def get_distance_to_closest_primary_road(self, lat, lon):
        '''
        Returns the distance in metres from the nearest primary road  - 1km radius
         i.e.  closest_primary_distance,
        '''
        try:
            G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
            gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
            gdf.to_crs(epsg=3310, inplace=True)
            gdf = gdf.reset_index()        
            # convert point to utm in order to get distance in metres
            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)        

            primary_gdf = gdf[gdf['highway'] == 'primary']
            if primary_gdf.shape[0] == 0:
                closest_primary_distance = None
            else:
                primary_roads = primary_gdf[['geometry', 'u', 'v']].values.tolist()
                primary_roads_with_distances = [(road, utm_point.distance(road[0])) for road in primary_roads]
                primary_roads_with_distances = sorted(
                    primary_roads_with_distances, key=lambda x: x[1])
                closest_primary_road = primary_roads_with_distances[0]
                closest_primary_distance = round(closest_primary_road[1], 2)            
        
        except Exception as ex: 
            closest_primary_distance = None
            print(ex)
      
        return closest_primary_distance 


    def get_distance_to_closest_secondary_road(self, lat, lon):
        '''
        Returns the distance in metres from the nearest secondary road  - 1km radius
         i.e.  closest_secondary_distance
        '''
        try:
            G = ox.graph_from_point((lat, lon), dist=1000, network_type='drive')
            gdf = ox.graph_to_gdfs(G, nodes=False, fill_edge_geometry=True)
            gdf.to_crs(epsg=3310, inplace=True)
            gdf = gdf.reset_index()        

            wgs84_pt = Point(lon, lat)
            wgs84 = pyproj.CRS('EPSG:4326')
            utm = pyproj.CRS('EPSG:3310')
            project = pyproj.Transformer.from_crs(wgs84, utm, always_xy=True).transform
            utm_point = transform(project, wgs84_pt)       

            secondary_gdf = gdf[gdf['highway'] == 'secondary']
            if secondary_gdf.shape[0] == 0:
                closest_secondary_distance = None
            else:
                secondary_roads = secondary_gdf[['geometry', 'u', 'v']].values.tolist()
                secondary_roads_with_distances = [(road, utm_point.distance(road[0])) for road in secondary_roads]
                secondary_roads_with_distances = sorted(
                    secondary_roads_with_distances, key=lambda x: x[1])
                closest_secondary_road = secondary_roads_with_distances[0]
                closest_secondary_distance = round(closest_secondary_road[1], 2)
        
        except Exception as ex: 
            closest_secondary_distance = None
            print(ex)
      
        return closest_secondary_distance
    
    


if __name__ == "__main__":
    extract = Extract()
    #extract.get_station_measurements('TA00654', startDate='2021-02-01', endDate='2021-07-12')
    #extract.get_all_available_variables_and_units_tahmo_api()    
    #extract.get_all_weather_station_account_has_access_on()

    
   