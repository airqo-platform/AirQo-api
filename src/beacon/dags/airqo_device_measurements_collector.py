import os
import json
import logging
import requests
import pendulum
import time
from datetime import datetime, timedelta, timezone
import pytz
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.models import Variable
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("airqo_recent_measurements_dag")

# Thread-safe logging lock
log_lock = threading.Lock()

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

def get_max_workers():
    """Determine optimal number of concurrent workers based on environment"""
    try:
        # Check for environment variable override
        env_workers = os.environ.get("AIRQO_MAX_WORKERS")
        if env_workers:
            workers = int(env_workers)
            logger.info(f"Using AIRQO_MAX_WORKERS from environment: {workers}")
            return max(1, min(workers, 50))  # Cap at 50 for API safety
        
        # Try Airflow variable
        try:
            airflow_workers = Variable.get("airqo_max_workers", default_var=None)
            if airflow_workers:
                workers = int(airflow_workers)
                logger.info(f"Using airqo_max_workers from Airflow variables: {workers}")
                return max(1, min(workers, 50))
        except:
            pass
        
        # Auto-detect based on CPU cores
        import multiprocessing
        cpu_count = multiprocessing.cpu_count()
        
        # Conservative approach: 2x CPU cores, capped for API safety
        auto_workers = min(cpu_count * 2, 20)
        logger.info(f"Auto-detected {cpu_count} CPU cores, using {auto_workers} workers")
        return auto_workers
        
    except Exception as e:
        logger.warning(f"Error determining max workers: {e}, defaulting to 5")
        return 5

def get_api_token():
    """Get API token for recent measurements API"""
    try:
        # Try environment variable first
        api_token = os.environ.get("AIRQO_API_TOKEN")
        logger.info(f"Environment variable AIRQO_API_TOKEN found: {'Yes' if api_token else 'No'}")
        
        if not api_token:
            try:
                # Try Airflow variable as backup
                api_token = Variable.get("airqo_api_token", default_var=None)
                logger.info(f"Airflow variable airqo_api_token found: {'Yes' if api_token else 'No'}")
            except:
                pass
        
        if not api_token:
            logger.error("No API token found in environment variables or Airflow variables")
            raise ValueError("API token is required but not found. Please set AIRQO_API_TOKEN environment variable or airqo_api_token Airflow variable")
        
        api_token = api_token.strip()
        logger.info(f"API Token configured successfully")
        
        return api_token
    except Exception as e:
        logger.error(f"Error getting API token: {str(e)}")
        raise

def get_deployed_devices(**kwargs):
    """Get all deployed devices from dim_device (using device_id for API calls)"""
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        
        query = """
        SELECT 
            device_key,
            device_id,
            device_name,
            network,
            category,
            status
        FROM dim_device 
        WHERE is_active = true 
          AND status = 'deployed'
          AND device_id IS NOT NULL
        ORDER BY device_name
        """
        
        results = pg_hook.get_records(query)
        
        if not results:
            logger.warning("No deployed devices found in dim_device table")
            return []
        
        devices = []
        for row in results:
            device_key, device_id, device_name, network, category, status = row
            devices.append({
                'device_key': device_key,
                'device_id': device_id,
                'device_name': device_name,
                'network': network,
                'category': category,
                'status': status
            })
        
        logger.info(f"Found {len(devices)} deployed devices")
        logger.info(f"Filter applied: is_active = true AND status = 'deployed'")
        logger.info(f"Using device_id from dim_device for individual API calls")
        return devices
        
    except Exception as e:
        logger.error(f"Error getting deployed devices: {str(e)}")
        raise

def fetch_recent_measurement(device_id, api_token):
    """Fetch recent measurement for a single device using device_id"""
    
    url = f"https://api.airqo.net/api/v2/devices/measurements/devices/{device_id}/recent"
    
    try:
        params = {'token': api_token}
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success', False):
            measurements = data.get('measurements', [])
            if measurements:
                logger.debug(f"Retrieved measurement for device {device_id}")
                return measurements[0]  # Get the most recent measurement
            else:
                logger.warning(f"No measurements found for device {device_id}")
                return None
        else:
            logger.warning(f"API returned success=false for device {device_id}: {data.get('message', 'Unknown error')}")
            return None
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed for device {device_id}: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching data for device {device_id}: {str(e)}")
        return None

def process_site_details(site_details, **kwargs):
    """Process and UPDATE (not insert) site details in dim_site table"""
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        conn = pg_hook.get_conn()
        conn.autocommit = False
        cursor = conn.cursor()
        
        if not site_details or not site_details.get('_id'):
            return None
        
        site_id = site_details['_id']
        
        # Extract site category
        site_category = None
        if 'site_category' in site_details and isinstance(site_details['site_category'], dict):
            site_category = site_details['site_category'].get('category')
        
        # Use UPSERT (INSERT ... ON CONFLICT UPDATE) for atomic operation
        upsert_sql = """
            INSERT INTO dim_site (
                site_id, site_name, location_name, search_name, village,
                town, city, district, country, data_provider, site_category,
                latitude, longitude, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
            )
            ON CONFLICT (site_id) DO UPDATE SET
                site_name = EXCLUDED.site_name,
                location_name = EXCLUDED.location_name,
                search_name = EXCLUDED.search_name,
                village = EXCLUDED.village,
                town = EXCLUDED.town,
                city = EXCLUDED.city,
                district = EXCLUDED.district,
                country = EXCLUDED.country,
                data_provider = EXCLUDED.data_provider,
                site_category = EXCLUDED.site_category,
                latitude = EXCLUDED.latitude,
                longitude = EXCLUDED.longitude,
                updated_at = NOW()
            RETURNING site_key
        """
        
        cursor.execute(upsert_sql, (
            site_id,
            site_details.get('name'),
            site_details.get('location_name'),
            site_details.get('search_name'),
            site_details.get('village'),
            site_details.get('town'),
            site_details.get('city'),
            site_details.get('district'),
            site_details.get('country'),
            site_details.get('data_provider'),
            site_category,
            site_details.get('approximate_latitude'),
            site_details.get('approximate_longitude')
        ))
        
        site_key = cursor.fetchone()[0]
        conn.commit()
        return site_key
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error processing site details: {str(e)}")
        return None
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def process_location_data(device_info, site_details, **kwargs):
    """Process and UPDATE (not keep history) location data in dim_location table"""
    
    if not site_details:
        logger.warning(f"No site details for device {device_info['device_id']}")
        return False
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        conn = pg_hook.get_conn()
        conn.autocommit = False
        cursor = conn.cursor()
        
        # Set timezone
        cursor.execute("SET timezone = 'Africa/Kampala';")
        now_kampala = datetime.now(timezone.utc).astimezone(uganda_tz)
        
        # Extract location data from site details
        latitude = site_details.get('approximate_latitude')
        longitude = site_details.get('approximate_longitude')
        
        if not latitude or not longitude:
            logger.warning(f"Missing coordinates for device {device_info['device_id']}")
            return False
        
        # Extract all location information
        site_id = site_details.get('_id')
        site_name = site_details.get('name')
        location_name = site_details.get('location_name')
        search_name = site_details.get('search_name')
        village = site_details.get('village')
        admin_level_country = site_details.get('country')
        admin_level_city = site_details.get('city')
        admin_level_division = site_details.get('district')
        
        # Extract site category
        site_category = None
        if 'site_category' in site_details and isinstance(site_details['site_category'], dict):
            site_category = site_details['site_category'].get('category')
        
        # Use UPSERT approach: find existing active location and update it, or insert new one
        upsert_sql = """
            WITH existing_location AS (
                SELECT location_key 
                FROM dim_location 
                WHERE device_key = %s AND is_active = true
                LIMIT 1
            ),
            updated_location AS (
                UPDATE dim_location 
                SET 
                    location_name = %s,
                    search_name = %s,
                    village = %s,
                    latitude = %s,
                    longitude = %s,
                    admin_level_country = %s,
                    admin_level_city = %s,
                    admin_level_division = %s,
                    site_category = %s,
                    site_id = %s,
                    site_name = %s,
                    recorded_at = %s
                WHERE device_key = %s AND is_active = true
                RETURNING location_key
            ),
            inserted_location AS (
                INSERT INTO dim_location (
                    device_key, location_name, search_name, village,
                    latitude, longitude, admin_level_country, admin_level_city, admin_level_division,
                    site_category, site_id, site_name,
                    effective_from, is_active, recorded_at
                )
                SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                WHERE NOT EXISTS (SELECT 1 FROM existing_location)
                RETURNING location_key
            )
            SELECT location_key FROM updated_location
            UNION ALL
            SELECT location_key FROM inserted_location
        """
        
        cursor.execute(upsert_sql, (
            # For finding existing location
            device_info['device_key'],
            # For updating existing location
            location_name, search_name, village,
            float(latitude), float(longitude),
            admin_level_country, admin_level_city, admin_level_division,
            site_category, site_id, site_name, now_kampala,
            device_info['device_key'],
            # For inserting new location
            device_info['device_key'], location_name, search_name, village,
            float(latitude), float(longitude),
            admin_level_country, admin_level_city, admin_level_division,
            site_category, site_id, site_name,
            now_kampala, True, now_kampala
        ))
        
        result = cursor.fetchone()
        if result:
            logger.debug(f"Updated/created location for device {device_info['device_id']}")
        
        conn.commit()
        return True
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error processing location data for device {device_info['device_id']}: {str(e)}")
        return False
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def process_health_tips(health_tips, reading_key, aqi_category, **kwargs):
    """Process and store health tips in fact_health_tips table"""
    
    if not health_tips or not reading_key:
        return
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        conn = pg_hook.get_conn()
        conn.autocommit = False
        cursor = conn.cursor()
        
        for tip in health_tips:
            if not tip.get('_id'):
                continue
            
            # Check if health tip already exists for this reading
            cursor.execute(
                "SELECT tip_key FROM fact_health_tips WHERE reading_key = %s AND tip_id = %s",
                (reading_key, tip['_id'])
            )
            
            if not cursor.fetchone():
                # Insert new health tip
                insert_sql = """
                    INSERT INTO fact_health_tips (
                        reading_key, tip_id, title, description, image_url, aqi_category
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """
                
                cursor.execute(insert_sql, (
                    reading_key,
                    tip['_id'],
                    tip.get('title'),
                    tip.get('description'),
                    tip.get('image'),
                    aqi_category
                ))
        
        conn.commit()
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error processing health tips: {str(e)}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def process_recent_measurement(device_info, measurement, **kwargs):
    """Process a single recent measurement to update support tables (NO readings modification)"""
    
    if not measurement:
        return False
    
    try:
        updated_components = []
        
        # Process site details and get site_key
        site_details = measurement.get('siteDetails')
        if site_details:
            site_key = process_site_details(site_details, **kwargs)
            if site_key:
                updated_components.append("site_details")
                logger.debug(f"Processed site details for device {device_info['device_id']}")
            
            # Process location data
            if process_location_data(device_info, site_details, **kwargs):
                updated_components.append("location_data")
                logger.debug(f"Processed location data for device {device_info['device_id']}")
        else:
            logger.warning(f"No site details found for device {device_info['device_id']}")
        
        # Process health tips (but we need a reading_key from existing readings)
        health_tips = measurement.get('health_tips', [])
        aqi_category = measurement.get('aqi_category')
        
        if health_tips:
            # Find the most recent reading for this device to link health tips
            pg_hook = PostgresHook(postgres_conn_id='postgres_default')
            conn = pg_hook.get_conn()
            cursor = conn.cursor()
            
            try:
                # Get the most recent reading_key for this device
                cursor.execute(
                    """
                    SELECT reading_key 
                    FROM fact_device_readings 
                    WHERE device_key = %s 
                    ORDER BY timestamp DESC 
                    LIMIT 1
                    """,
                    (device_info['device_key'],)
                )
                
                reading_result = cursor.fetchone()
                if reading_result:
                    reading_key = reading_result[0]
                    process_health_tips(health_tips, reading_key, aqi_category, **kwargs)
                    updated_components.append("health_tips")
                    logger.debug(f"Processed {len(health_tips)} health tips for device {device_info['device_id']}")
                else:
                    logger.debug(f"No existing readings found for device {device_info['device_id']} to link health tips")
                    
            finally:
                if cursor:
                    cursor.close()
                if conn:
                    conn.close()
        
        if updated_components:
            return True
        else:
            return False
        
    except Exception as e:
        logger.error(f"Error processing support data for device {device_info['device_id']}: {str(e)}")
        return False

def process_single_device(device_info, api_token, **kwargs):
    """Process a single device (thread-safe function for parallel execution)"""
    
    device_id = device_info['device_id']
    thread_id = threading.current_thread().name
    
    try:
        # Fetch recent measurement
        measurement = fetch_recent_measurement(device_id, api_token)
        
        if measurement:
            # Process support data
            success = process_recent_measurement(device_info, measurement, **kwargs)
            
            with log_lock:
                if success:
                    logger.debug(f"[{thread_id}] ✓ Successfully processed device {device_id}")
                else:
                    logger.debug(f"[{thread_id}] ✗ Failed to process device {device_id}")
            
            return {'device_id': device_id, 'success': success, 'thread': thread_id}
        else:
            with log_lock:
                logger.debug(f"[{thread_id}] ✗ No measurement data for device {device_id}")
            return {'device_id': device_id, 'success': False, 'thread': thread_id}
            
    except Exception as e:
        with log_lock:
            logger.error(f"[{thread_id}] ✗ Error processing device {device_id}: {str(e)}")
        return {'device_id': device_id, 'success': False, 'error': str(e), 'thread': thread_id}

def collect_recent_measurements(**kwargs):
    """Main function with PARALLEL processing of device API calls"""
    
    # Get execution time info
    execution_date = kwargs['execution_date']
    logger.info(f"=== PARALLEL RECENT MEASUREMENTS COLLECTION START ===")
    logger.info(f"Execution time: {execution_date}")
    
    ti = kwargs['ti']
    devices = ti.xcom_pull(task_ids='get_deployed_devices')
    
    if not devices:
        logger.warning("No deployed devices found, skipping recent measurements collection")
        return {'total_processed': 0, 'successful': 0, 'failed': 0, 'execution_time': str(execution_date)}
    
    api_token = get_api_token()
    max_workers = get_max_workers()
    
    logger.info(f"Strategy: PARALLEL processing with {max_workers} concurrent workers")
    logger.info(f"Total devices to process: {len(devices)}")
    logger.info(f"Purpose: Update dim_site, dim_location, and fact_health_tips tables ONLY")
    
    total_processed = 0
    successful_updates = 0
    failed_updates = 0
    
    # Process devices in chunks to manage memory and connections
    CHUNK_SIZE = max_workers * 5  # Process 5 "rounds" of workers at a time
    device_chunks = [devices[i:i + CHUNK_SIZE] for i in range(0, len(devices), CHUNK_SIZE)]
    
    logger.info(f"Processing {len(devices)} devices in {len(device_chunks)} chunks of up to {CHUNK_SIZE}")
    
    for chunk_num, device_chunk in enumerate(device_chunks):
        logger.info(f"=== Processing chunk {chunk_num + 1}/{len(device_chunks)} ({len(device_chunk)} devices) ===")
        
        # Use ThreadPoolExecutor for parallel processing
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="DeviceWorker") as executor:
            
            # Submit all devices in this chunk
            future_to_device = {
                executor.submit(process_single_device, device_info, api_token, **kwargs): device_info
                for device_info in device_chunk
            }
            
            # Process completed tasks as they finish
            chunk_successful = 0
            chunk_failed = 0
            
            for future in as_completed(future_to_device):
                total_processed += 1
                
                try:
                    result = future.result(timeout=60)  # 60 second timeout per device
                    
                    if result['success']:
                        successful_updates += 1
                        chunk_successful += 1
                    else:
                        failed_updates += 1
                        chunk_failed += 1
                        
                except Exception as e:
                    failed_updates += 1
                    chunk_failed += 1
                    device_info = future_to_device[future]
                    logger.error(f"Future exception for device {device_info['device_id']}: {str(e)}")
                
                # Progress logging
                if total_processed % 100 == 0:
                    logger.info(f"Progress: {total_processed}/{len(devices)} devices processed")
        
        # Chunk summary
        logger.info(f"Chunk {chunk_num + 1} complete: {chunk_successful} successful, {chunk_failed} failed")
        
        # Brief pause between chunks to be nice to the API
        if chunk_num < len(device_chunks) - 1:
            logger.info("Waiting 5 seconds before next chunk...")
            time.sleep(5)
    
    # Final summary
    success_rate = (successful_updates/total_processed*100) if total_processed > 0 else 0
    
    logger.info(f"=== PARALLEL PROCESSING COMPLETE ===")
    logger.info(f"Total devices processed: {total_processed}")
    logger.info(f"Successful support data updates: {successful_updates}")
    logger.info(f"Failed updates: {failed_updates}")
    logger.info(f"Success rate: {success_rate:.1f}%")
    logger.info(f"Concurrency: {max_workers} parallel workers")
    logger.info(f"Performance gain: ~{max_workers}x faster than sequential processing")
    logger.info(f"Execution time: {execution_date}")
    logger.info(f"NOTE: fact_device_readings table was NOT modified - only support tables updated")
    
    return {
        'total_processed': total_processed,
        'successful': successful_updates,
        'failed': failed_updates,
        'success_rate': round(success_rate, 1),
        'max_workers': max_workers,
        'chunks_processed': len(device_chunks),
        'execution_time': str(execution_date)
    }

# Create the DAG - Runs every 30 minutes
dag = DAG(
    'airqo_recent_support_data_collector',
    default_args=default_args,
    description='Update support tables (dim_site, dim_location, fact_health_tips) using individual device API calls every 30 minutes',
    schedule_interval='*/30 * * * *',  # Every 30 minutes
    start_date=pendulum.datetime(2025, 7, 21, 15, 0, tz="Africa/Kampala"),  # Start at 3:00 PM EAT
    catchup=False,
    tags=['airqo', 'support-data', 'health-tips', 'sites', 'locations', '30min'],
    max_active_runs=1,
)

# Create any missing tables (this ensures compatibility)
create_missing_tables_task = PostgresOperator(
    task_id='ensure_tables_exist',
    postgres_conn_id='postgres_default',
    sql="""
    -- Set timezone to Africa/Kampala for this session
    SET timezone = 'Africa/Kampala';
    
    -- Ensure all required tables exist (these should already be created by other DAGs)
    
    -- Create dim_site table if it doesn't exist
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

    -- Create fact_device_readings table if it doesn't exist (CLEANED VERSION)
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
        
        -- Environmental (removed all pressure columns and intake columns)
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
    
    -- Create fact_health_tips table if it doesn't exist
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
    
    -- Create performance indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_key ON fact_device_readings(device_key);
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_timestamp ON fact_device_readings(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_timestamp ON fact_device_readings(device_key, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_dim_site_site_id ON dim_site(site_id);
    CREATE INDEX IF NOT EXISTS idx_fact_health_tips_reading_key ON fact_health_tips(reading_key);
    """,
    dag=dag,
)

# Get all deployed devices from dim_device
get_deployed_devices_task = PythonOperator(
    task_id='get_deployed_devices',
    python_callable=get_deployed_devices,
    dag=dag,
)

# Collect recent measurements to update support tables only
collect_support_data_task = PythonOperator(
    task_id='collect_support_data',
    python_callable=collect_recent_measurements,
    dag=dag,
)

# Define task dependencies
create_missing_tables_task >> get_deployed_devices_task >> collect_support_data_task