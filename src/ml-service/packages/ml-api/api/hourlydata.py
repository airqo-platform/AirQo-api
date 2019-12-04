from google.cloud import bigquery

def query_data():
#lis =[]
    client = bigquery.Client()

    """query_job = client.query(
    """#SELECT created_at,channel_id,pm2_5
        #FROM `airqo-250220.thingspeak.feeds2_pms` LIMIT 10 """)
    #results = query_job.result()"""
    #i=0
    """for row in results:
            time = row[0].strftime("%Y/%m/%d/%I")
            return time"""
    sql = """SELECT created_at,channel_id,pm2_5
        FROM `airqo-250220.thingspeak.feeds2_pms` LIMIT 10"""
    df = client.query(sql).to_dataframe()
    return df.head()
            #while i<10:
                #lis.append(row)

                #i =i+1
    #return lis

print(query_data())
#create_date = row.strftime("%Y/%m%d%I")
