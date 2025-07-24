import os
import json
import logging
import requests
import pendulum
import pandas as pd
import time
from datetime import datetime, timedelta, timezone
import pytz
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.models import Variable
from io import StringIO

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("airqo_device_readings_dag")

# Define default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# Set Uganda timezone
uganda_tz = pytz.timezone('Africa/Kampala')

# Create the DAG - Runs every 15 minutes
dag = DAG(
    'airqo_device_readings_collector',
    default_args=default_args,
    description='Collect real-time sensor readings from AirQo devices every 15 minutes',
    schedule_interval='*/15 * * * *',  # Every 15 minutes using cron expression
    start_date=pendulum.datetime(2025, 7, 21, 14, 30, tz="Africa/Kampala"),  # Start at 2:30 PM EAT
    catchup=False,
    tags=['airqo', 'readings', 'real-time', '15min'],
    max_active_runs=1,
)

def get_jwt_token():
    """Get JWT token for raw-data API"""
    try:
        # Try environment variable first
        jwt_token = os.environ.get("AIRQO_JWT_TOKEN")
        logger.info(f"Environment variable AIRQO_JWT_TOKEN found: {'Yes' if jwt_token else 'No'}")
        
        if not jwt_token:
            try:
                # Try Airflow variable as backup
                jwt_token = Variable.get("airqo_jwt_token", default_var=None)
                logger.info(f"Airflow variable airqo_jwt_token found: {'Yes' if jwt_token else 'No'}")
            except:
                pass
        
        if not jwt_token:
            logger.error("No JWT token found in environment variables or Airflow variables")
            raise ValueError("JWT token is required but not found. Please set AIRQO_JWT_TOKEN environment variable or airqo_jwt_token Airflow variable")
        
        if jwt_token:
            # Clean the token (remove any extra whitespace/newlines)
            jwt_token = jwt_token.strip()
            
            # Ensure the token has the JWT prefix
            if not jwt_token.startswith("JWT "):
                jwt_token = f"JWT {jwt_token}"
                logger.info("Added JWT prefix to token")
            
            logger.info(f"JWT Token configured successfully")
        
        return jwt_token
    except Exception as e:
        logger.error(f"Error getting JWT token: {str(e)}")
        raise

def get_device_categories_and_names(**kwargs):
    """Get all device categories with their corresponding device names from dim_device"""
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        
        query = """
        SELECT 
            category,
            device_name,
            network,
            COUNT(*) OVER (PARTITION BY category) as category_total
        FROM dim_device 
        WHERE is_active = true 
          AND status = 'deployed'
          AND category IS NOT NULL
          AND device_name IS NOT NULL
          AND network IS NOT NULL
        ORDER BY category, device_name
        """
        
        results = pg_hook.get_records(query)
        
        if not results:
            logger.warning("No active deployed devices found in dim_device table")
            return {}
        
        # Group devices by category
        categories = {}
        
        for row in results:
            category, device_name, network, category_total = row
            
            if category not in categories:
                categories[category] = {
                    'device_names': [],
                    'network': network,
                    'total_devices': category_total
                }
            
            categories[category]['device_names'].append(device_name)
        
        # Log what we found
        logger.info(f"Found {len(categories)} device categories:")
        for category, data in categories.items():
            logger.info(f"  - {category}: {len(data['device_names'])} devices (network: {data['network']})")
            logger.info(f"    Sample devices: {data['device_names'][:3]}{'...' if len(data['device_names']) > 3 else ''}")
        
        return categories
        
    except Exception as e:
        logger.error(f"Error getting device categories: {str(e)}")
        raise

def parse_csv_response(csv_data):
    """Parse the CSV response from the raw-data API"""
    
    if not csv_data or csv_data.strip() == "":
        logger.warning("Empty CSV response received")
        return []
    
    try:
        # Split into lines and clean
        lines = [line.strip() for line in csv_data.strip().split('\n') if line.strip()]
        
        if len(lines) < 2:
            logger.warning(f"CSV response has insufficient data: {len(lines)} lines")
            return []
        
        # First line contains headers
        headers = [h.strip() for h in lines[0].split(',')]
        logger.info(f"CSV Headers: {headers[:10]}...")  # Log first 10 headers
        
        readings = []
        
        # Process each data line
        for line_num, line in enumerate(lines[1:], start=2):
            try:
                # Split by comma and handle empty values
                values = []
                for value in line.split(','):
                    clean_value = value.strip()
                    # Convert empty strings and 'None' to None
                    if clean_value == '' or clean_value.lower() == 'none':
                        values.append(None)
                    else:
                        values.append(clean_value)
                
                # Ensure we have the correct number of values
                if len(values) != len(headers):
                    logger.warning(f"Line {line_num}: Expected {len(headers)} values, got {len(values)}")
                    # Pad with None if too few values, truncate if too many
                    while len(values) < len(headers):
                        values.append(None)
                    values = values[:len(headers)]
                
                # Create dictionary mapping headers to values
                reading_dict = dict(zip(headers, values))
                readings.append(reading_dict)
                
            except Exception as e:
                logger.error(f"Error parsing line {line_num}: {str(e)}")
                continue
        
        logger.info(f"Successfully parsed {len(readings)} readings from CSV response")
        return readings
        
    except Exception as e:
        logger.error(f"Error parsing CSV response: {str(e)}")
        return []

def map_device_ids_to_keys(readings, **kwargs):
    """Map device_id from API to device_key from database"""
    
    if not readings:
        return []
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        
        # Get all device mappings
        device_mapping_query = """
        SELECT device_name, device_key, network, category
        FROM dim_device 
        WHERE is_active = true AND status = 'deployed'
        """
        
        device_mappings = {}
        device_metadata = {}
        
        results = pg_hook.get_records(device_mapping_query)
        for device_name, device_key, network, category in results:
            device_mappings[device_name] = device_key
            device_metadata[device_name] = {'network': network, 'category': category}
        
        mapped_readings = []
        unmapped_devices = set()
        
        for reading in readings:
            api_device_id = reading.get('device_id')  # From API response
            
            # Map API device_id to database device_name (they should match)
            if api_device_id and api_device_id in device_mappings:
                reading['device_key'] = device_mappings[api_device_id]
                
                # Add metadata from dim_device
                metadata = device_metadata[api_device_id]
                reading['network'] = metadata['network']
                reading['device_category'] = metadata['category']
                
                mapped_readings.append(reading)
            else:
                if api_device_id:
                    unmapped_devices.add(api_device_id)
        
        if unmapped_devices:
            logger.warning(f"Unmapped devices ({len(unmapped_devices)}): {list(unmapped_devices)[:5]}...")
        
        logger.info(f"Successfully mapped {len(mapped_readings)}/{len(readings)} readings to database devices")
        return mapped_readings
        
    except Exception as e:
        logger.error(f"Error mapping device IDs to keys: {str(e)}")
        return []

def process_and_store_readings(readings, **kwargs):
    """Process readings and store them in the database"""
    
    if not readings:
        logger.info("No readings to process")
        return 0
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        conn = pg_hook.get_conn()
        conn.autocommit = False
        cursor = conn.cursor()
        
        successful_inserts = 0
        failed_inserts = 0
        
        # Current real-time for reference
        now_utc = datetime.now(timezone.utc)
        
        for reading in readings:
            try:
                # Get timestamp from API response
                timestamp_str = reading.get('timestamp')
                if not timestamp_str:
                    logger.warning("Reading missing timestamp, skipping")
                    failed_inserts += 1
                    continue
                
                # Parse timestamp from API response
                try:
                    # Clean up timestamp string
                    timestamp_str = str(timestamp_str).strip()
                    
                    # Handle different timestamp formats
                    if '+00:00' in timestamp_str:
                        timestamp_utc = datetime.fromisoformat(timestamp_str)
                    elif timestamp_str.endswith('Z'):
                        timestamp_utc = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
                        timestamp_utc = pytz.utc.localize(timestamp_utc)
                    elif ' ' in timestamp_str and '+00:00' in timestamp_str:
                        # Handle format: "2025-07-21 12:18:43+00:00"
                        timestamp_utc = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S+00:00")
                        timestamp_utc = pytz.utc.localize(timestamp_utc)
                    else:
                        # Try parsing as ISO format
                        timestamp_utc = datetime.fromisoformat(timestamp_str)
                        if timestamp_utc.tzinfo is None:
                            timestamp_utc = pytz.utc.localize(timestamp_utc)
                    
                    # Convert to Uganda time for storage
                    timestamp_uganda = timestamp_utc.astimezone(uganda_tz)
                    
                    # Log time difference for verification (only for first few readings)
                    if successful_inserts < 3:
                        time_diff = now_utc - timestamp_utc
                        logger.info(f"Data timestamp: {timestamp_utc} (real-time: {now_utc}) - {time_diff.total_seconds()/60:.1f} min behind")
                    
                except Exception as e:
                    logger.error(f"Error parsing timestamp '{timestamp_str}': {str(e)}")
                    failed_inserts += 1
                    continue
                
                # Helper functions for safe conversion
                def safe_float(value):
                    if value is None or value == '' or str(value).lower() in ['none', 'nan', 'null']:
                        return None
                    try:
                        return float(value)
                    except (ValueError, TypeError):
                        return None
                
                def safe_int(value):
                    if value is None or value == '' or str(value).lower() in ['none', 'nan', 'null']:
                        return None
                    try:
                        return int(float(value))
                    except (ValueError, TypeError):
                        return None
                
                # Handle site_id and potentially create site record
                site_key = None
                site_id = reading.get('site_id')
                if site_id and site_id != 'None':
                    cursor.execute("SELECT site_key FROM dim_site WHERE site_id = %s", (site_id,))
                    site_result = cursor.fetchone()
                    if site_result:
                        site_key = site_result[0]
                    else:
                        # Insert new site record
                        cursor.execute(
                            """
                            INSERT INTO dim_site (site_id, latitude, longitude)
                            VALUES (%s, %s, %s)
                            RETURNING site_key
                            """,
                            (site_id, safe_float(reading.get('latitude')), safe_float(reading.get('longitude')))
                        )
                        site_key = cursor.fetchone()[0]
                
                # Insert reading record (removed columns as requested)
                insert_sql = """
                INSERT INTO fact_device_readings (
                    device_key, site_key, timestamp,
                    s1_pm2_5, s1_pm10, s2_pm2_5, s2_pm10,
                    temperature, humidity, wind_speed,
                    device_temperature, device_humidity, battery, altitude,
                    latitude, longitude, hdop, satellites,
                    frequency, network, device_category
                ) VALUES (
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s
                )
                ON CONFLICT (device_key, timestamp) DO NOTHING
                """
                
                values = (
                    reading.get('device_key'),
                    site_key,
                    timestamp_uganda,
                    # PM readings (only s1 and s2)
                    safe_float(reading.get('s1_pm2_5')),
                    safe_float(reading.get('s1_pm10')),
                    safe_float(reading.get('s2_pm2_5')),
                    safe_float(reading.get('s2_pm10')),
                    # Environmental (removed pressure columns)
                    safe_float(reading.get('temperature')),
                    safe_float(reading.get('humidity')),
                    safe_float(reading.get('wind_speed')),
                    # Device hardware
                    safe_float(reading.get('device_temperature')),
                    safe_float(reading.get('device_humidity')),
                    safe_float(reading.get('battery')),
                    safe_float(reading.get('altitude')),
                    # GPS
                    safe_float(reading.get('latitude')),
                    safe_float(reading.get('longitude')),
                    safe_float(reading.get('hdop')),
                    safe_int(reading.get('satellites')),
                    # Metadata (removed tenant and raw_data)
                    reading.get('frequency'),
                    reading.get('network'),
                    reading.get('device_category')
                )
                
                cursor.execute(insert_sql, values)
                successful_inserts += 1
                
                # Progress logging every 100 inserts
                if successful_inserts % 100 == 0:
                    logger.info(f"Processed {successful_inserts} readings...")
                
            except Exception as e:
                logger.error(f"Error inserting reading: {str(e)}")
                failed_inserts += 1
                continue
        
        # Commit all successful inserts
        conn.commit()
        
        logger.info(f"DATABASE INSERT COMPLETE: Success: {successful_inserts}, Failed: {failed_inserts}")
        return successful_inserts
        
    except Exception as e:
        logger.error(f"Error processing readings: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()
        raise
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

def collect_readings_for_all_categories(**kwargs):
    """Main function to collect readings for all categories every 15 minutes"""
    
    # Get execution time info
    execution_date = kwargs['execution_date']
    logger.info(f"=== AIRQO READINGS COLLECTION START ===")
    logger.info(f"Execution time: {execution_date}")
    
    ti = kwargs['ti']
    categories = ti.xcom_pull(task_ids='get_device_categories_and_names')
    
    if not categories:
        logger.warning("No device categories found, skipping reading collection")
        return {'total_readings': 0, 'categories_processed': 0, 'execution_time': str(execution_date)}
    
    jwt_token = get_jwt_token()
    url = "https://platform.airqo.net/api/v2/analytics/raw-data"
    
    # Calculate API request time: (current time - 15min) to (current time)
    now_utc = datetime.now(timezone.utc)
    
    # Start time: current time - 15 minutes
    start_time = now_utc - timedelta(minutes=30)- timedelta(hours=1)  # Adjust for UTC to EAT conversion
    # End time: current time
    end_time = now_utc
    
    # Log time calculations
    logger.info(f"=== TIME CALCULATION ===")
    logger.info(f"Current real-time (UTC): {now_utc.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Start time calculation: {now_utc.strftime('%H:%M:%S')} - 15min = {start_time.strftime('%H:%M:%S')}")
    logger.info(f"Request window: {start_time.strftime('%Y-%m-%d %H:%M:%S')} to {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Window duration: 15 minutes")
    logger.info(f"Expected response data: real-time data")
    
    total_readings_collected = 0
    categories_processed = 0
    
    for category, category_data in categories.items():
        device_names = category_data['device_names']
        network = category_data['network']
        
        logger.info(f"=== PROCESSING CATEGORY: {category.upper()} ===")
        logger.info(f"Devices: {len(device_names)}, Network: {network}")
        
        # Split devices into batches to avoid API timeouts
        MAX_DEVICES_PER_REQUEST = 50
        device_batches = [device_names[i:i + MAX_DEVICES_PER_REQUEST] 
                         for i in range(0, len(device_names), MAX_DEVICES_PER_REQUEST)]
        
        category_readings = []
        
        for batch_num, device_batch in enumerate(device_batches):
            logger.info(f"  Processing batch {batch_num + 1}/{len(device_batches)}: {len(device_batch)} devices")
            
            # Build API request body
            body = {
                "network": "airqo",  # Use airqo as the standard network for all requests
                "device_category": category,
                "device_names": device_batch,
                "startDateTime": start_time.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                "endDateTime": end_time.strftime('%Y-%m-%dT%H:%M:%S.000Z'),
                "frequency": "raw"
            }
            
            logger.info(f"    API Request: {body['startDateTime']} to {body['endDateTime']}")
            
            try:
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': jwt_token  # Use Authorization header, not token header
                }
                
                # Debug logging (without sensitive data)
                logger.info(f"    JWT Token configured: Yes")
                logger.info(f"    Request URL: {url}")
                logger.info(f"    Request body: {json.dumps(body, indent=2)}")
                
                # Make API request
                response = requests.post(url, headers=headers, json=body, timeout=120)
                response.raise_for_status()
                
                # Parse CSV response
                csv_data = response.text
                batch_readings = parse_csv_response(csv_data)
                
                # Log sample timestamp for verification
                if batch_readings and len(batch_readings) > 0:
                    sample_timestamp = batch_readings[0].get('timestamp')
                    logger.info(f"    Sample response timestamp: {sample_timestamp}")
                
                logger.info(f"    Retrieved {len(batch_readings)} readings from API")
                category_readings.extend(batch_readings)
                
                # Rate limiting - be nice to the API
                time.sleep(3)
                
            except requests.exceptions.RequestException as e:
                logger.error(f"    API request failed for batch {batch_num + 1}: {str(e)}")
                # Log response details if available
                if hasattr(e, 'response') and e.response is not None:
                    logger.error(f"    Response status: {e.response.status_code}")
                    logger.error(f"    Response headers: {dict(e.response.headers)}")
                    try:
                        logger.error(f"    Response body: {e.response.text[:500]}")
                    except:
                        pass
                continue
            except Exception as e:
                logger.error(f"    Unexpected error in batch {batch_num + 1}: {str(e)}")
                continue
        
        # Process and store readings for this category
        if category_readings:
            logger.info(f"  Processing {len(category_readings)} total readings for {category}")
            
            # Map device IDs to keys
            mapped_readings = map_device_ids_to_keys(category_readings, **kwargs)
            
            if mapped_readings:
                # Store in database
                stored_count = process_and_store_readings(mapped_readings, **kwargs)
                total_readings_collected += stored_count
                logger.info(f"  ✓ Successfully stored {stored_count} readings for category '{category}'")
            else:
                logger.warning(f"  ✗ No valid mapped readings for category '{category}'")
        else:
            logger.warning(f"  ✗ No readings retrieved for category '{category}'")
        
        categories_processed += 1
        
        # Small delay between categories
        time.sleep(5)
    
    # Final summary
    logger.info(f"=== COLLECTION COMPLETE ===")
    logger.info(f"Total readings collected: {total_readings_collected}")
    logger.info(f"Categories processed: {categories_processed}")
    logger.info(f"Execution time: {execution_date}")
    
    return {
        'total_readings': total_readings_collected,
        'categories_processed': categories_processed,
        'execution_time': str(execution_date),
        'success': True
    }

# Create all necessary tables
create_tables_task = PostgresOperator(
    task_id='create_tables',
    postgres_conn_id='postgres_default',
    sql="""
    -- Set timezone to Africa/Kampala for this session
    SET timezone = 'Africa/Kampala';
    
    -- Create dim_site table if it doesn't exist (for site reference)
    CREATE TABLE IF NOT EXISTS dim_site (
        site_key SERIAL PRIMARY KEY,
        site_id VARCHAR(100) UNIQUE NOT NULL,
        site_name VARCHAR(255),
        location_name VARCHAR(255),
        search_name VARCHAR(255),
        village VARCHAR(255),
        town VARCHAR(255),
        city VARCHAR(255),
        district VARCHAR(255),
        country VARCHAR(255),
        data_provider VARCHAR(100),
        site_category VARCHAR(100),
        latitude FLOAT,
        longitude FLOAT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create fact_device_readings table (main readings table) - CLEANED VERSION
    CREATE TABLE IF NOT EXISTS fact_device_readings (
        reading_key SERIAL PRIMARY KEY,
        device_key INTEGER REFERENCES dim_device(device_key) ON DELETE CASCADE,
        site_key INTEGER REFERENCES dim_site(site_key),
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        
        -- PM readings (only s1 and s2, removed pm1, pm2_5, pm10, s1_pm1, s2_pm1)
        s1_pm2_5 FLOAT,
        s1_pm10 FLOAT,
        s2_pm2_5 FLOAT,
        s2_pm10 FLOAT,
        
        -- Environmental (removed all pressure columns)
        temperature FLOAT,
        humidity FLOAT,
        wind_speed FLOAT,
        
        -- Device hardware
        device_temperature FLOAT,
        device_humidity FLOAT,
        battery FLOAT,
        altitude FLOAT,
        
        -- GPS data
        latitude FLOAT,
        longitude FLOAT,
        hdop FLOAT,
        satellites INTEGER,
        
        -- Metadata (removed tenant and raw_data columns)
        frequency VARCHAR(20),
        network VARCHAR(50),
        device_category VARCHAR(50),
        
        -- Audit fields
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Prevent duplicate readings
        UNIQUE(device_key, timestamp)
    );
    
    -- Create fact_health_tips table (for health recommendations based on readings)
    CREATE TABLE IF NOT EXISTS fact_health_tips (
        tip_key SERIAL PRIMARY KEY,
        reading_key INTEGER REFERENCES fact_device_readings(reading_key) ON DELETE CASCADE,
        tip_id VARCHAR(100) NOT NULL,
        title VARCHAR(255),
        description TEXT,
        image_url VARCHAR(500),
        aqi_category VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create performance indexes
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_key ON fact_device_readings(device_key);
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_timestamp ON fact_device_readings(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_s1_pm2_5 ON fact_device_readings(s1_pm2_5) WHERE s1_pm2_5 IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_s2_pm2_5 ON fact_device_readings(s2_pm2_5) WHERE s2_pm2_5 IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_timestamp ON fact_device_readings(device_key, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_category ON fact_device_readings(device_category);
    
    CREATE INDEX IF NOT EXISTS idx_dim_site_site_id ON dim_site(site_id);
    CREATE INDEX IF NOT EXISTS idx_dim_site_coords ON dim_site(latitude, longitude);
    
    CREATE INDEX IF NOT EXISTS idx_fact_health_tips_reading_key ON fact_health_tips(reading_key);
    CREATE INDEX IF NOT EXISTS idx_fact_health_tips_aqi ON fact_health_tips(aqi_category);
    """,
    dag=dag,
)

# Get device categories and names from existing dim_device table
get_categories_and_names_task = PythonOperator(
    task_id='get_device_categories_and_names',
    python_callable=get_device_categories_and_names,
    dag=dag,
)

# Collect readings for all categories
collect_all_readings_task = PythonOperator(
    task_id='collect_readings_all_categories',
    python_callable=collect_readings_for_all_categories,
    dag=dag,
)

# Define task dependencies
create_tables_task >> get_categories_and_names_task >> collect_all_readings_task