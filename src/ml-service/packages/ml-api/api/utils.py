from google.cloud import bigquery

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


if __name__ == '__main__':
    channel_id = get_channel_id("0.693610","34.181519")
    print(channel_id)
    
    

    