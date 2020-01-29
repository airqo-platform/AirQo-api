import base64
from google.cloud import bigquery
import json
from datetime import datetime
import pandas as pd
import requests

MET_API_URL= "https://api-metoffice.apiconnect.ibmcloud.com/metoffice/production/v0/forecasts/point/hourly"
MET_API_CLIENT_ID= "edaf40c5-4d6c-4cf1-ba93-e435f5ed6ab4"
MET_API_CLIENT_SECRET ="bN5aN6vK2cR8pJ8uI7xM3bB6fK1aK6hW6nJ1tM2uF4uM2eE8eC"

    
def get_all_static_channels():
    client = bigquery.Client()

    query = """
        SELECT channel_id, latitude, longitude
        FROM `airqo-250220.thingspeak.channel`
        WHERE latitude != 0.0 OR longitude != 0.0
    """
    
    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config)

    results = query_job.result()
    static_channels = []

    if results.total_rows >=1:
        for row in results:
            static_channels.append({"channel_id":row.channel_id,"latitude":row.latitude, "longitude":row.longitude})
    return static_channels
    
def save_weather_forecasts(weather_forecasts):
    client = bigquery.Client()
    dataset_ref = client.dataset('thingspeak','airqo-250220')
    table_ref = dataset_ref.table('met_office_weather_forecast')
    table = client.get_table(table_ref)

    rows_to_insert = weather_forecasts
    errors = client.insert_rows(table, rows_to_insert)
    if errors == []:
        return 'Records saved successfully.'
    else:
        return errors
    
  
def get_location_hourly_weather_forecasts(latitude:float, longitude:float):
        headers = { 'x-ibm-client-id': MET_API_CLIENT_ID,
        'x-ibm-client-secret': MET_API_CLIENT_SECRET,
        'accept': "application/json"
        }

        parameters = {
            "excludeParameterMetadata":"true",
            "includeLocationName":"true",
            "latitude":latitude,
            "longitude":longitude
        }

        api_url= MET_API_URL

        forecast_results = requests.get(api_url, headers=headers, params=parameters)

        return forecast_results.json(), forecast_results.status_code     
  
def get_hourly_met_forecastsx(event, context):
    """
        gets hourly spot wether forecasts from met 
        office(https://metoffice.apiconnect.ibmcloud.com/metoffice/production/)
        saves them to big query table.
    """
    pubsub_message = base64.b64decode(event['data']).decode('utf-8')
    if (pubsub_message == "get_weather_forecasts"):
        weather_predictions=[]
        specified_locations = get_all_static_channels()
        #specified_locationsx = specified_locations[0:2]
        if specified_locations:
            for i in range(0, len(specified_locations)):
                channel_id = specified_locations[i].get('channel_id')
                latitude = specified_locations[i].get('latitude')
                longitude = specified_locations[i].get('longitude')

                forecast_results, status_code = get_location_hourly_weather_forecasts(latitude, longitude)

                if status_code == 200 :
                    features_geometry = forecast_results['features'][0]['geometry']
                    features_properties = forecast_results['features'][0]['properties']
                    forecast_timeseries = features_properties['timeSeries']
                    location = features_properties['location'].get('name')
                    location_lat = features_geometry.get('coordinates')[1]    
                    location_long = features_geometry.get('coordinates')[0]
                    point_elevation = features_geometry.get('coordinates')[2]
                    distance_from_requested_point = features_properties['requestPointDistance']
                    created_at  =  datetime.now()

                    if forecast_timeseries:
                        for i in range(0, len(forecast_timeseries)):
                            location_name = location    
                            location_latitude = location_lat    
                            location_longitude = location_long   
                            time = pd.to_datetime(forecast_timeseries[i].get('time')) 
                            screen_temperature =  forecast_timeseries[i].get('screenTemperature')  
                            screen_dewpoint_temperature =  forecast_timeseries[i].get('screenDewPointTemperature')
                            feels_like_temperature = forecast_timeseries[i].get('feelsLikeTemperature') 
                            wind_speed_10m  =    forecast_timeseries[i].get('windSpeed10m')
                            wind_direction_from_10m =   forecast_timeseries[i].get('windDirectionFrom10m') 
                            wind_gust_speed_10m  =  forecast_timeseries[i].get('windGustSpeed10m')
                            visibility  = forecast_timeseries[i].get('visibility')
                            screen_relative_humidity = forecast_timeseries[i].get('screenRelativeHumidity')  
                            mean_sea_level_pressure  =    forecast_timeseries[i].get('mslp') 
                            uvIndex =    forecast_timeseries[i].get('uvIndex')
                            significant_weather_code =   forecast_timeseries[i].get('significantWeatherCode')
                            precipitation_rate =  forecast_timeseries[i].get('precipitationRate')
                            total_precipitation_amount =  forecast_timeseries[i].get('totalPrecipAmount')
                            total_snow_amount =   forecast_timeseries[i].get('totalSnowAmount')
                            prob_of_precipitation =  forecast_timeseries[i].get('probOfPrecipitation ')
                            created_at  =  created_at
                            airqo_channel_id = channel_id 
                            elevation = point_elevation
                            request_distance_point = distance_from_requested_point

                            weather_predictions_tuple = (location_name, location_latitude, location_longitude, time,
                                screen_temperature, screen_dewpoint_temperature, feels_like_temperature, wind_speed_10m,
                                wind_direction_from_10m, wind_gust_speed_10m, visibility, screen_relative_humidity,
                                 mean_sea_level_pressure, uvIndex, significant_weather_code, precipitation_rate,
                                 total_precipitation_amount, total_snow_amount, prob_of_precipitation, created_at,
                                  airqo_channel_id, elevation, request_distance_point)


                            weather_predictions.append(weather_predictions_tuple)


            results = save_weather_forecasts(weather_predictions)


        else:
            return "Failed to get forecasts for specified coordinates", status_code



def get_hourly_met_forecasts():
    """
        gets hourly spot wether forecasts from met 
        office(https://metoffice.apiconnect.ibmcloud.com/metoffice/production/)
        saves them to big query table.
    """
    weather_predictions=[]
    specified_locations = get_all_static_channels()
    #specified_locationsx = specified_locations[0:2]
    if specified_locations:
        for i in range(0, len(specified_locations)):
            channel_id = specified_locations[i].get('channel_id')
            latitude = specified_locations[i].get('latitude')
            longitude = specified_locations[i].get('longitude')

            forecast_results, status_code = get_location_hourly_weather_forecasts(latitude, longitude)

            if status_code == 200 :
                features_geometry = forecast_results['features'][0]['geometry']
                features_properties = forecast_results['features'][0]['properties']
                forecast_timeseries = features_properties['timeSeries']
                location = features_properties['location'].get('name')
                location_lat = features_geometry.get('coordinates')[1]    
                location_long = features_geometry.get('coordinates')[0]
                point_elevation = features_geometry.get('coordinates')[2]
                distance_from_requested_point = features_properties['requestPointDistance']
                created_at  =  datetime.now()

                if forecast_timeseries:
                    for i in range(0, len(forecast_timeseries)):
                        location_name = location    
                        location_latitude = location_lat    
                        location_longitude = location_long   
                        time = pd.to_datetime(forecast_timeseries[i].get('time')) 
                        screen_temperature =  forecast_timeseries[i].get('screenTemperature')  
                        screen_dewpoint_temperature =  forecast_timeseries[i].get('screenDewPointTemperature')
                        feels_like_temperature = forecast_timeseries[i].get('feelsLikeTemperature') 
                        wind_speed_10m  =    forecast_timeseries[i].get('windSpeed10m')
                        wind_direction_from_10m =   forecast_timeseries[i].get('windDirectionFrom10m') 
                        wind_gust_speed_10m  =  forecast_timeseries[i].get('windGustSpeed10m')
                        visibility  = forecast_timeseries[i].get('visibility')
                        screen_relative_humidity = forecast_timeseries[i].get('screenRelativeHumidity')  
                        mean_sea_level_pressure  =    forecast_timeseries[i].get('mslp') 
                        uvIndex =    forecast_timeseries[i].get('uvIndex')
                        significant_weather_code =   forecast_timeseries[i].get('significantWeatherCode')
                        precipitation_rate =  forecast_timeseries[i].get('precipitationRate')
                        total_precipitation_amount =  forecast_timeseries[i].get('totalPrecipAmount')
                        total_snow_amount =   forecast_timeseries[i].get('totalSnowAmount')
                        prob_of_precipitation =  forecast_timeseries[i].get('probOfPrecipitation ')
                        created_at  =  created_at
                        airqo_channel_id = channel_id 
                        elevation = point_elevation
                        request_distance_point = distance_from_requested_point

                        weather_predictions_tuple = (location_name, location_latitude, location_longitude, time,
                            screen_temperature, screen_dewpoint_temperature, feels_like_temperature, wind_speed_10m,
                            wind_direction_from_10m, wind_gust_speed_10m, visibility, screen_relative_humidity,
                             mean_sea_level_pressure, uvIndex, significant_weather_code, precipitation_rate,
                             total_precipitation_amount, total_snow_amount, prob_of_precipitation, created_at,
                              airqo_channel_id, elevation, request_distance_point)

                        
                        weather_predictions.append(weather_predictions_tuple)

        #print(weather_predictions)
        save_json_data('weather_forecast.json', weather_predictions)

        #results = save_weather_forecasts(weather_predictions)
        #print(results)

    else:
        return "Failed to get forecasts for specified coordinates", status_code



if __name__ == '__main__':
    
    #get_closest_channel(0.540184, 31.439622)
    #get_all_coordinates()

    print('main')

    get_hourly_met_forecasts()