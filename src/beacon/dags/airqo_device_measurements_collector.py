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
from datetime import datetime, timedelta, timezone
import pytz

# Default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=2),
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

# Function to fetch recent measurements for a specific device
def fetch_device_measurements(device_id, **kwargs):
    import time
    
    token = get_airqo_token()
    api_url = f"https://api.airqo.net/api/v2/devices/measurements/devices/{device_id}/recent?token={token}"
    
    print(f"Starting API request for device {device_id} at {datetime.now().isoformat()}")
    start_time = time.time()
    
    for attempt in range(3):
        try:
            print(f"Attempt {attempt+1}/3 for device {device_id}")
            
            # Use a session to better control the connection
            session = requests.Session()
            
            # Set a longer timeout (90 seconds)
            response = session.get(
                api_url, 
                timeout=90,
                headers={
                    'User-Agent': 'AirQo-Data-Pipeline/1.0',
                    'Accept': 'application/json'
                }
            )
            
            elapsed = time.time() - start_time
            print(f"Request completed in {elapsed:.2f} seconds with status code {response.status_code}")
            
            response.raise_for_status()
            data = response.json()
            
            if not data.get('success', False):
                print(f"API returned success=false for device {device_id}: {data.get('message', 'Unknown error')}")
                return None
            
            # Log basic stats about the response
            measurements = data.get('measurements', [])
            print(f"Received {len(measurements)} measurements for device {device_id}")
            
            return {
                'device_id': device_id,
                'data': data
            }
            
        except requests.exceptions.Timeout:
            elapsed = time.time() - start_time
            print(f"Timeout error (attempt {attempt+1}/3) after {elapsed:.2f} seconds")
            # Don't sleep after the last attempt
            if attempt < 2:
                print(f"Waiting 5 seconds before retry...")
                time.sleep(5)
                
        except Exception as e:
            print(f"Error fetching measurements for device {device_id}: {type(e).__name__}: {str(e)}")
            # Don't retry on non-timeout errors
            return None
    
    print(f"Failed to fetch measurements for device {device_id} after 3 attempts")
    return None

# Modify the process_all_devices function to process one device at a time
def process_all_devices(**kwargs):
    import time
    
    ti = kwargs['ti']
    device_ids = ti.xcom_pull(task_ids='get_device_ids')
    
    if not device_ids:
        print("No device IDs found. Skipping measurements collection.")
        return []
    
    print(f"Processing {len(device_ids)} devices one by one")
    measurements_by_device = []
    
    for i, device_id in enumerate(device_ids):
        print(f"Processing device {i+1}/{len(device_ids)}: {device_id}")
        measurements = fetch_device_measurements(device_id)
        
        if measurements and measurements.get('data'):
            measurements_by_device.append(measurements)
            print(f"Successfully processed device {device_id}")
        else:
            print(f"Failed to process device {device_id}")
        
        # Add a delay between devices to avoid overwhelming the API
        # and to allow network connections to fully close
        if i < len(device_ids) - 1:
            print(f"Waiting 3 seconds before processing next device...")
            time.sleep(3)
    
    print(f"Successfully fetched measurements for {len(measurements_by_device)} out of {len(device_ids)} devices")
    return measurements_by_device
# Function to process all devices
def process_all_devices(**kwargs):
    ti = kwargs['ti']
    device_ids = ti.xcom_pull(task_ids='get_device_ids')
    
    if not device_ids:
        print("No device IDs found. Skipping measurements collection.")
        return []
    
    measurements_by_device = []
    for device_id in device_ids:
        measurements = fetch_device_measurements(device_id)
        if measurements and measurements.get('data'):
            measurements_by_device.append(measurements)
    
    print(f"Successfully fetched measurements for {len(measurements_by_device)} devices")
    return measurements_by_device

# Function to store measurements in the database
def store_measurements(**kwargs):
    ti = kwargs['ti']
    all_measurements = ti.xcom_pull(task_ids='process_all_devices')
    
    if not all_measurements:
        print("No measurements to store. Skipping.")
        return
    
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    connection = pg_hook.get_conn()
    
    inserted_count = 0
    skipped_count = 0
    
    try:
        # Set the timezone for this database session to Kampala
        cursor = connection.cursor()
        cursor.execute("SET timezone = 'Africa/Kampala';")
        cursor.close()
        
        for device_data in all_measurements:
            device_id = device_data['device_id']
            response_data = device_data['data']
            measurements = response_data.get('measurements', [])
            
            # Get device_key for the device_id
            cursor = connection.cursor()
            cursor.execute("SELECT device_key FROM dim_device WHERE device_id = %s", (device_id,))
            result = cursor.fetchone()
            
            if not result:
                print(f"Device {device_id} not found in dim_device table. Skipping.")
                skipped_count += len(measurements)
                cursor.close()
                continue
            
            device_key = result[0]
            
            # Process each measurement
            for measurement in measurements:
                try:
                    # Extract timestamp
                    timestamp_str = measurement.get('time')
                    if not timestamp_str:
                        continue
                    
                    # Parse timestamp and ensure it's timezone-aware (UTC)
                    try:
                        # If timestamp has ISO format with Z (UTC)
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    except:
                        try:
                            # If timestamp has microseconds format with Z
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                            # Make it timezone-aware (UTC)
                            timestamp = timestamp.replace(tzinfo=timezone.utc)
                        except:
                            # If timestamp has seconds format with Z
                            timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                            # Make it timezone-aware (UTC)
                            timestamp = timestamp.replace(tzinfo=timezone.utc)
                    
                    # Extract measurements data
                    pm2_5 = measurement.get('pm2_5', {}).get('value')
                    pm10 = measurement.get('pm10', {}).get('value')
                    no2 = measurement.get('no2', {}).get('value')
                    
                    # Extract site data
                    site_id = measurement.get('site_id')
                    device_name = measurement.get('device')
                    frequency = measurement.get('frequency')
                    is_reading_primary = measurement.get('is_reading_primary', False)
                    
                    # AQI information
                    aqi_category = measurement.get('aqi_category')
                    aqi_color = measurement.get('aqi_color')
                    aqi_color_name = measurement.get('aqi_color_name')
                    
                    # Get site details
                    site_details = measurement.get('siteDetails', {})
                    site_name = site_details.get('name')
                    location_name = site_details.get('location_name')
                    search_name = site_details.get('search_name')
                    village = site_details.get('village')
                    town = site_details.get('town')
                    city = site_details.get('city')
                    district = site_details.get('district')
                    country = site_details.get('country')
                    data_provider = site_details.get('data_provider')
                    
                    # Get site category
                    site_category = site_details.get('site_category', {}).get('category')
                    
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
                        skipped_count += 1
                        continue
                    
                    # Get current time in Kampala timezone for created_at/last_updated
                    now_kampala = datetime.now(timezone.utc).astimezone(pytz.timezone('Africa/Kampala'))
                    
                    # Insert site data if not exists or update if exists
                    if site_id:
                        cursor.execute(
                            """
                            SELECT site_key FROM dim_site 
                            WHERE site_id = %s
                            """, 
                            (site_id,)
                        )
                        site_result = cursor.fetchone()
                        
                        site_key = None
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
                                    village = %s,
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
                                    site_name, location_name, search_name, village,
                                    town, city, district, country, data_provider,
                                    site_category, now_kampala, site_key
                                )
                            )
                        else:
                            # Insert new site
                            cursor.execute(
                                """
                                INSERT INTO dim_site
                                (site_id, site_name, location_name, search_name, village, town, city, 
                                district, country, data_provider, site_category, created_at, last_updated)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                RETURNING site_key
                                """,
                                (
                                    site_id, site_name, location_name, search_name, village,
                                    town, city, district, country, data_provider,
                                    site_category, now_kampala, now_kampala
                                )
                            )
                            site_key = cursor.fetchone()[0]
                    
                    # Insert the measurement with extended data
                    cursor.execute(
                        """
                        INSERT INTO fact_device_readings 
                        (device_key, timestamp, pm2_5, pm10, no2, site_key, device_name, 
                        frequency, is_reading_primary, aqi_category, aqi_color, aqi_color_name)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING reading_key
                        """,
                        (
                            device_key, timestamp, pm2_5, pm10, no2, site_key, device_name,
                            frequency, is_reading_primary, aqi_category, aqi_color, aqi_color_name
                        )
                    )
                    
                    reading_key = cursor.fetchone()[0]
                    
                    # Store health tips if available
                    health_tips = measurement.get('health_tips', [])
                    for tip in health_tips:
                        tip_id = tip.get('_id')
                        title = tip.get('title')
                        description = tip.get('description')
                        image = tip.get('image')
                        
                        cursor.execute(
                            """
                            INSERT INTO fact_health_tips
                            (reading_key, tip_id, title, description, image_url)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (reading_key, tip_id, title, description, image)
                        )
                    
                    # Store AQI ranges if available
                    aqi_ranges = measurement.get('aqi_ranges', {})
                    for range_type, range_values in aqi_ranges.items():
                        min_value = range_values.get('min')
                        max_value = range_values.get('max')
                        
                        cursor.execute(
                            """
                            INSERT INTO fact_aqi_ranges
                            (reading_key, range_type, min_value, max_value)
                            VALUES (%s, %s, %s, %s)
                            """,
                            (reading_key, range_type, min_value, max_value)
                        )
                    
                    inserted_count += 1
                    
                except Exception as e:
                    print(f"Error processing measurement for device {device_id}: {str(e)}")
                    continue
            
            cursor.close()
        
        # Commit all changes
        connection.commit()
        print(f"Measurements processing complete. Inserted: {inserted_count}, Skipped: {skipped_count}")
        
    except Exception as e:
        connection.rollback()
        print(f"Error in store_measurements: {str(e)}")
        raise
    finally:
        connection.close()
# Create the DAG
with DAG(
    'airqo_device_measurements_collector',
    default_args=default_args,
    description='Collect recent measurements from AirQo API for all devices',
    schedule_interval=timedelta(minutes=60),  # Run every 60 minutes
    start_date=datetime(2025, 4, 1),
    catchup=False,
    tags=['airqo', 'measurements', 'api'],
) as dag:
    
    # Create necessary tables
    # Create necessary tables
    setup_tables = PostgresOperator(
        task_id='setup_tables',
        postgres_conn_id='postgres_default',
        sql="""
        -- Set timezone to Africa/Kampala for this session
        SET timezone = 'Africa/Kampala';
        
        -- Create site dimension table if not exists
        CREATE TABLE IF NOT EXISTS dim_site (
            site_key SERIAL PRIMARY KEY,
            site_id VARCHAR(100) UNIQUE,
            site_name VARCHAR(255),
            location_name VARCHAR(255),
            search_name VARCHAR(255),
            village VARCHAR(255),
            town VARCHAR(255),
            city VARCHAR(255),
            district VARCHAR(255),
            country VARCHAR(100),
            data_provider VARCHAR(100),
            site_category VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Modify fact_device_readings to store additional data
        CREATE TABLE IF NOT EXISTS fact_device_readings (
            reading_key SERIAL PRIMARY KEY,
            device_key INTEGER REFERENCES dim_device(device_key),
            site_key INTEGER REFERENCES dim_site(site_key),
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            device_name VARCHAR(100),
            pm2_5 DECIMAL(10, 5),
            pm10 DECIMAL(10, 5),
            pm1 DECIMAL(10, 5),
            no2 DECIMAL(10, 5),
            o3 DECIMAL(10, 5),
            temperature_celsius DECIMAL(5, 2),
            humidity_percent DECIMAL(5, 2),
            battery_voltage DECIMAL(5, 2),
            signal_strength_dbm INTEGER,
            frequency VARCHAR(20),
            is_reading_primary BOOLEAN DEFAULT FALSE,
            aqi_category VARCHAR(50),
            aqi_color VARCHAR(20),
            aqi_color_name VARCHAR(50),
            UNIQUE(device_key, timestamp)
        );
        
        -- Create table for health tips
        CREATE TABLE IF NOT EXISTS fact_health_tips (
            tip_key SERIAL PRIMARY KEY,
            reading_key INTEGER REFERENCES fact_device_readings(reading_key) ON DELETE CASCADE,
            tip_id VARCHAR(100),
            title VARCHAR(255),
            description TEXT,
            image_url TEXT,
            UNIQUE(reading_key, tip_id)
        );
        
        -- Create table for AQI ranges
        CREATE TABLE IF NOT EXISTS fact_aqi_ranges (
            range_key SERIAL PRIMARY KEY,
            reading_key INTEGER REFERENCES fact_device_readings(reading_key) ON DELETE CASCADE,
            range_type VARCHAR(50),
            min_value DECIMAL(10, 3),
            max_value DECIMAL(10, 3),
            UNIQUE(reading_key, range_type)
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_timestamp 
        ON fact_device_readings(device_key, timestamp);
        
        CREATE INDEX IF NOT EXISTS idx_fact_device_readings_timestamp 
        ON fact_device_readings(timestamp);
        
        CREATE INDEX IF NOT EXISTS idx_fact_device_readings_site 
        ON fact_device_readings(site_key);
        
        CREATE INDEX IF NOT EXISTS idx_fact_health_tips_reading 
        ON fact_health_tips(reading_key);
        
        CREATE INDEX IF NOT EXISTS idx_fact_aqi_ranges_reading 
        ON fact_aqi_ranges(reading_key);
        """
    )
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
        task_id='store_measurements',
        python_callable=store_measurements,
    )
    
    # Set up task dependencies
    setup_tables >> get_device_ids_task >> process_devices_task >> store_measurements_task