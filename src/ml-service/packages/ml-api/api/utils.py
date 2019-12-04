from google.cloud import bigquery
from geopy import distance
from api import model_config

def get_channel_id(latitude:str, longitude:str) -> int:
    lat= latitude
    lon = longitude

    channel_id = 0
    
    value1 = "'"+lat+"'"
    value2 = "'"+lon +"'"

    client = bigquery.Client()

    query = """
        SELECT channel_id
        FROM `airqo-250220.thingspeak.feeds1_pms`
        WHERE field5 = {0}
        AND field6 = {1}
        LIMIT 1
    """
    query = query.format(value1, value2)
    print(query)

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    query_job = client.query(
        query,job_config=job_config,
    )  # API request - starts the query
     
    results = query_job.result()
    if results.total_rows >=1:
        for row in results:
            channel_id = row.channel_id
            #print(row.channel_id)
    else:
        channel_id =0

    return channel_id


def checkKey(dict, key): 
    if key in dict.keys(): 
        return dict[key]
    else: 
        return "Channel Id Not available"


def get_closest_channel(latitude, longitude) -> int:
    '''gets and returns the channel with the minimum distance 
     from the location with the specified latitude and longitude'''
    specified_coordinates = (latitude  , longitude)
    all_channel_coordinates_dict = model_config.CHANNEL_ID_COORDINATES_CONFIG_DICT
    channel_ids_with_distances_from_specified_coordinates = {}

    for channel_id, coordinates in all_channel_coordinates_dict.items():
        #print(channel_id, ":", "latitude :",coordinates.get('latitude'), 
            #"longitude :", coordinates.get('longitude'))
        channel_coordinates = (coordinates.get('latitude'), coordinates.get('longitude'))
        distance_between_coordinates = distance.distance(specified_coordinates, channel_coordinates).km
        channel_ids_with_distances_from_specified_coordinates[channel_id]= distance_between_coordinates

    #print(channel_ids_with_distances_from_specified_coordinates)
    channel_id_with_min_distance= min(channel_ids_with_distances_from_specified_coordinates.keys(), key=(lambda k: channel_ids_with_distances_from_specified_coordinates[k]))
    minimum_distance = channel_ids_with_distances_from_specified_coordinates[channel_id_with_min_distance]
    print(minimum_distance, channel_id_with_min_distance)
    return channel_id_with_min_distance

if __name__ == '__main__':
    #channel_id = get_channel_id("0.693610","34.181519")
    #print(channel_id)

    get_closest_channel(0.540184, 31.439622)
    
    

    