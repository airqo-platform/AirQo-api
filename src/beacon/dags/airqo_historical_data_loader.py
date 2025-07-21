from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
import requests
import json
import os
from airflow.models import Variable
import time
import pandas as pd

# Default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

# Function to get the AirQo API token
def get_airqo_token():
    token = os.environ.get("AIRQO_API_TOKEN")
    if not token:
        try:
            token = Variable.get("airqo_api_token", default_var=None)
        except:
            pass
    
    if not token:
        raise ValueError("AirQo API token not found in environment variables or Airflow variables")
    
    return token

# Function to get all device IDs from the database
def get_device_ids(**kwargs):
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    
    # Query to get device IDs of active, deployed devices
    device_query = """
    SELECT device_id FROM dim_device 
    WHERE is_active = true AND status = 'deployed'
    """
    
    connection = pg_hook.get_conn()
    cursor = connection.cursor()
    cursor.execute(device_query)
    device_ids = [row[0] for row in cursor.fetchall()]
    cursor.close()
    connection.close()
    
    print(f"Found {len(device_ids)} active and deployed devices")
    
    # Store device IDs for later tasks
    return device_ids

# Function to fetch historical measurements for a specific device
def fetch_device_historical_data(device_id, start_date=None, end_date=None, **kwargs):
    token = get_airqo_token()
    
    # Build API URL
    api_url = f"https://api.airqo.net/api/v2/devices/measurements/devices/{device_id}/historical?token={token}"
    
    # Add date ranges if provided
    params = {}
    if start_date:
        params['startTime'] = start_date
    if end_date:
        params['endTime'] = end_date
    
    print(f"Starting historical data request for device {device_id}")
    print(f"URL: {api_url}")
    start_time = time.time()
    
    all_measurements = []
    page = 1
    more_pages = True
    
    while more_pages:
        params['page'] = page
        
        for attempt in range(3):
            try:
                print(f"Fetching page {page} for device {device_id} (Attempt {attempt+1}/3)")
                
                # Use a session to better control the connection
                session = requests.Session()
                
                # Set a longer timeout (120 seconds)
                response = session.get(
                    api_url, 
                    params=params,
                    timeout=120,
                    headers={
                        'User-Agent': 'AirQo-Data-Pipeline/1.0',
                        'Accept': 'application/json'
                    }
                )
                
                response.raise_for_status()
                data = response.json()
                
                if not data.get('success', False):
                    print(f"API returned success=false for device {device_id}: {data.get('message', 'Unknown error')}")
                    return None
                
                # Log basic stats about the response
                measurements = data.get('measurements', [])
                meta = data.get('meta', {})
                total_pages = meta.get('pages', 0)
                
                print(f"Page {page}/{total_pages}: Received {len(measurements)} measurements for device {device_id}")
                
                # Add measurements to our collection
                all_measurements.extend(measurements)
                
                # Check if there are more pages
                if page >= total_pages:
                    more_pages = False
                
                # Move to next page
                page += 1
                
                # Add a small delay to avoid rate limiting
                time.sleep(1)
                
                # Success, break out of retry loop
                break
                
            except requests.exceptions.Timeout:
                elapsed = time.time() - start_time
                print(f"Timeout error (attempt {attempt+1}/3) after {elapsed:.2f} seconds")
                # Don't sleep after the last attempt
                if attempt < 2:
                    print(f"Waiting 10 seconds before retry...")
                    time.sleep(10)
                    
            except Exception as e:
                print(f"Error fetching measurements for device {device_id}: {type(e).__name__}: {str(e)}")
                # Don't retry on non-timeout errors
                return None
    
    elapsed = time.time() - start_time
    print(f"Completed fetching all {len(all_measurements)} measurements for device {device_id} in {elapsed:.2f} seconds")
    
    # Save to temporary file to avoid memory issues
    temp_file = f"/tmp/historical_data_{device_id}.json"
    with open(temp_file, 'w') as f:
        json.dump(all_measurements, f)
    
    return {
        'device_id': device_id,
        'filename': temp_file,
        'records_count': len(all_measurements)
    }

# Function to process historical data for all devices
def process_all_devices(**kwargs):
    ti = kwargs['ti']
    device_ids = ti.xcom_pull(task_ids='get_device_ids')
    
    if not device_ids:
        print("No device IDs found. Skipping historical data collection.")
        return []
    
    # Get date range for historical data (default to last 365 days)
    end_date = datetime.now().isoformat()
    start_date = (datetime.now() - timedelta(days=365)).isoformat()
    
    print(f"Processing {len(device_ids)} devices for historical data")
    print(f"Date range: {start_date} to {end_date}")
    
    results = []
    for i, device_id in enumerate(device_ids):
        print(f"Processing device {i+1}/{len(device_ids)}: {device_id}")
        result = fetch_device_historical_data(device_id, start_date, end_date)
        
        if result:
            results.append(result)
            print(f"Successfully processed device {device_id} with {result['records_count']} records")
        else:
            print(f"Failed to process device {device_id}")
        
        # Add a delay between devices to avoid overwhelming the API
        if i < len(device_ids) - 1:
            print(f"Waiting 5 seconds before processing next device...")
            time.sleep(5)
    
    print(f"Successfully fetched historical data for {len(results)} out of {len(device_ids)} devices")
    return results

# Function to store historical measurements in the database
def store_historical_measurements(**kwargs):
    ti = kwargs['ti']
    all_device_results = ti.xcom_pull(task_ids='process_all_devices')
    
    if not all_device_results:
        print("No historical data to store. Skipping.")
        return
    
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    
    total_inserted = 0
    total_skipped = 0
    
    for device_result in all_device_results:
        device_id = device_result['device_id']
        filename = device_result['filename']
        
        print(f"Processing historical data for device {device_id} from {filename}")
        
        # Open the temporary file
        try:
            with open(filename, 'r') as f:
                measurements = json.load(f)
        except Exception as e:
            print(f"Error opening file {filename}: {str(e)}")
            continue
        
        # Get device_key for the device_id
        connection = pg_hook.get_conn()
        cursor = connection.cursor()
        
        try:
            cursor.execute("SELECT device_key FROM dim_device WHERE device_id = %s", (device_id,))
            result = cursor.fetchone()
            
            if not result:
                print(f"Device {device_id} not found in dim_device table. Skipping.")
                cursor.close()
                connection.close()
                continue
            
            device_key = result[0]
            
            # Process the measurements in batches to avoid memory issues
            batch_size = 1000
            inserted_count = 0
            skipped_count = 0
            
            for i in range(0, len(measurements), batch_size):
                batch = measurements[i:i+batch_size]
                batch_inserted = 0
                batch_skipped = 0
                
                for measurement in batch:
                    try:
                        # Extract timestamp
                        timestamp_str = measurement.get('time')
                        if not timestamp_str:
                            continue
                        
                        # Parse timestamp
                        try:
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        except:
                            try:
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                            except:
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                        
                        # Extract measurements data
                        pm2_5 = measurement.get('pm2_5', {}).get('value')
                        pm10 = measurement.get('pm10', {}).get('value')
                        no2 = measurement.get('no2', {}).get('value')
                        
                        # Extract site data
                        site_id = measurement.get('site_id')
                        device_name = measurement.get('device')
                        frequency = measurement.get('frequency')
                        
                        # Check if this measurement already exists
                        cursor.execute(
                            """
                            SELECT 1 FROM fact_device_readings 
                            WHERE device_key = %s AND timestamp = %s
                            LIMIT 1
                            """, 
                            (device_key, timestamp)
                        )
                        
                        if cursor.fetchone():
                            # Measurement already exists, skip
                            batch_skipped += 1
                            continue
                        
                        # Get site details
                        site_details = measurement.get('siteDetails', {})
                        site_name = site_details.get('name')
                        location_name = site_details.get('location_name')
                        search_name = site_details.get('search_name')
                        town = site_details.get('town')
                        city = site_details.get('city')
                        district = site_details.get('district')
                        country = site_details.get('country')
                        data_provider = site_details.get('data_provider')
                        
                        # Get site category
                        site_category = site_details.get('site_category', {}).get('category')
                        
                        # Insert site data if not exists or update if exists
                        site_key = None
                        if site_id:
                            cursor.execute(
                                """
                                SELECT site_key FROM dim_site 
                                WHERE site_id = %s
                                """, 
                                (site_id,)
                            )
                            site_result = cursor.fetchone()
                            
                            if site_result:
                                # Site exists, update it
                                site_key = site_result[0]
                                cursor.execute(
                                    """
                                    UPDATE dim_site
                                    SET 
                                        site_name = %s,
                                        location_name = %s,
                                        search_name = %s,
                                        town = %s,
                                        city = %s,
                                        district = %s,
                                        country = %s,
                                        data_provider = %s,
                                        site_category = %s,
                                        last_updated = %s
                                    WHERE site_key = %s
                                    """,
                                    (
                                        site_name, location_name, search_name,
                                        town, city, district, country, data_provider,
                                        site_category, datetime.now(), site_key
                                    )
                                )
                            else:
                                # Insert new site
                                cursor.execute(
                                    """
                                    INSERT INTO dim_site
                                    (site_id, site_name, location_name, search_name, town, city, 
                                    district, country, data_provider, site_category, created_at, last_updated)
                                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                    RETURNING site_key
                                    """,
                                    (
                                        site_id, site_name, location_name, search_name,
                                        town, city, district, country, data_provider,
                                        site_category, datetime.now(), datetime.now()
                                    )
                                )
                                site_key = cursor.fetchone()[0]
                        
                        # Insert the measurement
                        cursor.execute(
                            """
                            INSERT INTO fact_device_readings 
                            (device_key, timestamp, pm2_5, pm10, no2, site_key, device_name, frequency)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                device_key, timestamp, pm2_5, pm10, no2, site_key, device_name, frequency
                            )
                        )
                        
                        batch_inserted += 1
                        
                    except Exception as e:
                        print(f"Error processing measurement: {str(e)}")
                        connection.rollback()  # Rollback on error
                        skipped_count += 1
                        continue
                
                # Commit the batch
                connection.commit()
                inserted_count += batch_inserted
                skipped_count += batch_skipped
                
                print(f"Batch processed: Inserted {batch_inserted}, Skipped {batch_skipped}")
            
            print(f"Completed processing {device_id}: Inserted {inserted_count}, Skipped {skipped_count}")
            total_inserted += inserted_count
            total_skipped += skipped_count
            
        except Exception as e:
            print(f"Error in store_historical_measurements for device {device_id}: {str(e)}")
            connection.rollback()
            
        finally:
            cursor.close()
            connection.close()
            
            # Clean up the temporary file
            try:
                os.remove(filename)
                print(f"Deleted temporary file {filename}")
            except:
                print(f"Failed to delete temporary file {filename}")
    
    print(f"Historical data processing complete. Total Inserted: {total_inserted}, Total Skipped: {total_skipped}")
    return {
        "total_inserted": total_inserted,
        "total_skipped": total_skipped
    }

# Create the DAG
with DAG(
    'airqo_historical_data_loader',
    default_args=default_args,
    description='One-time loader for historical measurements from AirQo API',
    schedule_interval=None,  # Run only when triggered manually
    start_date=datetime(2025, 4, 1),
    catchup=False,
    tags=['airqo', 'historical', 'one-time', 'measurements'],
) as dag:
    
    # Task to get device IDs
    get_device_ids_task = PythonOperator(
        task_id='get_device_ids',
        python_callable=get_device_ids,
    )
    
    # Task to process all devices
    process_devices_task = PythonOperator(
        task_id='process_all_devices',
        python_callable=process_all_devices,
    )
    
    # Task to store measurements
    store_measurements_task = PythonOperator(
        task_id='store_historical_measurements',
        python_callable=store_historical_measurements,
    )
    
    # Set up task dependencies
    get_device_ids_task >> process_devices_task >> store_measurements_task