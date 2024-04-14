from models.pull_satellite_data import DataHandler
from datetime import datetime, timedelta
import time
import pytz
import schedule

WAIT_TIME =12

def run_data_processing_job():
    # Create an instance of DataHandler
    data_handler = DataHandler()

    # Example usage of query_bigquery_batch
    start_time = datetime.now(tz=pytz.UTC) - timedelta(days=16)
    end_time = datetime.now(tz=pytz.UTC)
  #  start_time = datetime(2023, 12, 1, 0, 0, 0, tzinfo=pytz.UTC)
  #  end_time  =datetime(2024, 3, 30, 23, 59, 59, tzinfo=pytz.UTC)
    batch_size = 5000
    total_rows = 0
    last_timestamp = None
    retry_counter = 0
    max_retries = 2  # Maximum number of retries
    
    

    while start_time <= end_time:
        print("Querying BigQuery...")
        data = data_handler.query_bigquery_batch(start_time=start_time, end_time=end_time, batch_size=batch_size)
        if data is None or data.empty:
            if retry_counter < max_retries:
                print("No data found. Retrying in two weeks...")
                time.sleep(10)  # Sleep for two minutes
                retry_counter += 1
                continue
            else:
                print("No data found after maximum retries. Scheduling to run again in two weeks.")
                schedule.every(WAIT_TIME).minutes.do(run_data_processing_job)
                return
        print("Querying BigQuery complete.")

        print("Processing geolocation data...")
        geo_data = data_handler.site_geolocation_data(data)
        site_names = data_handler.get_site_names(data)
        site_df = data_handler.get_site_df(data)
        
        print("Getting image data for sites...")
        dfs = data_handler.get_image_data(site_df)
        print("Image data retrieved.")

        print("Processing site data...")
        site_dfs = data_handler.process_site_data(dfs)
        print("Site data processed.")

        print("Merging site data...")
        all_data_dfs = data_handler.merge_site_data(site_dfs)
        print("Site data merged.")

        print("Extracting and merging data...")
        merged_df_ = data_handler.extract_and_merge_data(data, all_data_dfs)
        print(merged_df_)
        if merged_df_.empty:
            print("No merged data. Scheduling to run again in 12 minutes weeks.")
            schedule.every(WAIT_TIME).minutes.do(run_data_processing_job)
            return
        else:
            data_handler.save_to_mongodb(merged_df_)
            print("Merged data saved to MongoDB.")
        print("Data extraction and merging complete.")
        #data_handler.save_to_mongodb(merged_df_)
        print("Merged data saved to MongoDB.")

        total_rows += len(data)
        last_timestamp = data.iloc[-1]['timestamp']
        start_time = last_timestamp  + timedelta(seconds=1)
                
        print(f"Processed {total_rows} rows.")
        print(start_time  )
        print(f"Pause for 1/2 minutes before next 5000 batch....")
        # Pause for 2 minutes before next batch
        time.sleep(50)