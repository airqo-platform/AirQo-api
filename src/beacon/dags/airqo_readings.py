import os
import json
import logging
import requests
import pendulum
from datetime import datetime, timedelta
import pytz
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.models import Variable
from sqlalchemy import create_engine

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("airqo_device_metrics_dag")

# Define default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
}

# Set Uganda timezone
uganda_tz = pytz.timezone('Africa/Kampala')

# Create the DAG
dag = DAG(
    'airqo_device_metrics',
    default_args=default_args,
    description='Collect metrics from deployed AirQo devices',
    schedule_interval='*/15 * * * *',  # Run every 15 minutes
    start_date=pendulum.datetime(2025, 5, 20, tz="Africa/Kampala"),
    catchup=False,
    tags=['airqo', 'metrics', 'api'],
)

# Create metrics table if it doesn't exist
create_metrics_table = PostgresOperator(
    task_id='create_metrics_table',
    postgres_conn_id='postgres_default',
    sql="""
    DO $$ 
    BEGIN
        -- Check if table exists
        IF NOT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'airqo_device_metrics'
        ) THEN
            -- Check if sequence exists and drop it if it does
            IF EXISTS (
                SELECT FROM pg_sequences 
                WHERE sequencename = 'airqo_device_metrics_id_seq'
            ) THEN
                DROP SEQUENCE airqo_device_metrics_id_seq CASCADE;
            END IF;
            
            -- Create the table
            CREATE TABLE airqo_device_metrics (
                id SERIAL PRIMARY KEY,
                device_id INTEGER NOT NULL,
                device_channel VARCHAR(255) NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                pm2_5 FLOAT,
                pm10 FLOAT,
                s2_pm2_5 FLOAT,
                s2_pm10 FLOAT,
                latitude FLOAT,
                longitude FLOAT,
                battery FLOAT,
                altitude FLOAT,
                speed FLOAT,
                satellites FLOAT,
                hdop FLOAT,
                internal_temperature FLOAT,
                internal_humidity FLOAT,
                external_temperature FLOAT,
                external_humidity FLOAT,
                external_pressure FLOAT,
                external_altitude FLOAT,
                device_type VARCHAR(255),
                raw_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Create indices for frequently queried columns
            CREATE INDEX idx_airqo_device_metrics_device_id ON airqo_device_metrics(device_id);
            CREATE INDEX idx_airqo_device_metrics_timestamp ON airqo_device_metrics(timestamp);
            CREATE INDEX idx_airqo_device_metrics_device_channel ON airqo_device_metrics(device_channel);
        END IF;
    END
    $$;
    """,
    dag=dag,
)

# Load API token from environment variable or Airflow Variable
def get_api_token():
    """Retrieve API token from Airflow Variables"""
    try:
        return Variable.get("airqo_api_token", default_var="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NmU4NzdjYzQ0NDVkZTAwMTM1NDIyNTIiLCJmaXJzdE5hbWUiOiJLYXNhc2EgTGl2aW5nc3RvbmUgVHJldm9yIiwibGFzdE5hbWUiOiJLYXNhc2EgTGl2aW5nc3RvbmUgVHJldm9yIiwidXNlck5hbWUiOiJrYXNhc2F0cmV2b3IyNUBnbWFpbC5jb20iLCJlbWFpbCI6Imthc2FzYXRyZXZvcjI1QGdtYWlsLmNvbSIsIm9yZ2FuaXphdGlvbiI6ImFpcnFvIiwibG9uZ19vcmdhbml6YXRpb24iOiJhaXJxbyIsInByaXZpbGVnZSI6InVzZXIiLCJjb3VudHJ5IjpudWxsLCJwcm9maWxlUGljdHVyZSI6bnVsbCwicGhvbmVOdW1iZXIiOm51bGwsImNyZWF0ZWRBdCI6IjIwMjQtMDktMTYgMTg6MjQ6MTIiLCJ1cGRhdGVkQXQiOiIyMDI0LTA5LTE2IDE4OjI0OjEyIiwicmF0ZUxpbWl0IjpudWxsLCJsYXN0TG9naW4iOiIyMDI1LTA1LTIwVDEzOjU5OjM2LjgxMloiLCJpYXQiOjE3NDc3NDk1NzZ9.bvuFt9z1Fd9TKIo1ZTTbKt0QcxPRG3Wz47VB8vZXf1Y")
    except:
        logger.warning("Could not find 'airqo_api_token' in Airflow Variables. Using fallback token.")
        return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NmU4NzdjYzQ0NDVkZTAwMTM1NDIyNTIiLCJmaXJzdE5hbWUiOiJLYXNhc2EgTGl2aW5nc3RvbmUgVHJldm9yIiwibGFzdE5hbWUiOiJLYXNhc2EgTGl2aW5nc3RvbmUgVHJldm9yIiwidXNlck5hbWUiOiJrYXNhc2F0cmV2b3IyNUBnbWFpbC5jb20iLCJlbWFpbCI6Imthc2FzYXRyZXZvcjI1QGdtYWlsLmNvbSIsIm9yZ2FuaXphdGlvbiI6ImFpcnFvIiwibG9uZ19vcmdhbml6YXRpb24iOiJhaXJxbyIsInByaXZpbGVnZSI6InVzZXIiLCJjb3VudHJ5IjpudWxsLCJwcm9maWxlUGljdHVyZSI6bnVsbCwicGhvbmVOdW1iZXIiOm51bGwsImNyZWF0ZWRBdCI6IjIwMjQtMDktMTYgMTg6MjQ6MTIiLCJ1cGRhdGVkQXQiOiIyMDI0LTA5LTE2IDE4OjI0OjEyIiwicmF0ZUxpbWl0IjpudWxsLCJsYXN0TG9naW4iOiIyMDI1LTA1LTIwVDEzOjU5OjM2LjgxMloiLCJpYXQiOjE3NDc3NDk1NzZ9.bvuFt9z1Fd9TKIo1ZTTbKt0QcxPRG3Wz47VB8vZXf1Y"

def get_deployed_devices():
    """Retrieve all deployed and online devices from the devices table"""
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        conn = pg_hook.get_conn()
        cursor = conn.cursor()
        
        # Query to get deployed AND online devices, using device_number as the channel
        cursor.execute("""
            SELECT id, device_number AS device_channel 
            FROM devices 
            WHERE status = 'deployed' 
            AND is_online = true 
            AND device_number IS NOT NULL
        """)
        
        devices = cursor.fetchall()
        logger.info(f"Retrieved {len(devices)} deployed and online devices with device_number")
        
        # Close the database connection
        cursor.close()
        conn.close()
        
        return devices
    except Exception as e:
        logger.error(f"Error getting deployed devices: {str(e)}")
        raise e

def fetch_device_metrics(device_id, device_channel):
    """Fetch metrics for a specific device from the AirQo API"""
    try:
        # Set up API request
        url = f"https://platform.airqo.net/api/v2/devices/feeds/transform/recent"
        params = {"channel": device_channel}
        
        # Get API token
        token = get_api_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # Make the API request with proper error handling
        try:
            response = requests.get(url, params=params, headers=headers, timeout=(30.0, 30.0))
            response.raise_for_status()  # Raise exception for 4XX/5XX responses
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for device {device_channel}: {str(e)}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"Response status: {e.response.status_code}, content: {e.response.text[:200]}...")
            return None
        
        # Parse the JSON response
        try:
            metrics_data = response.json()
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response for device {device_channel}: {str(e)}")
            return None
        
        # Return the metrics data along with the device ID for database storage
        return {
            "device_id": device_id,
            "device_channel": device_channel,
            "metrics": metrics_data
        }
    except Exception as e:
        logger.error(f"Unexpected error fetching metrics for device {device_channel}: {str(e)}")
        return None

def process_metrics_data(metrics_response):
    """Process the metrics data for database storage with better error handling"""
    if not metrics_response:
        return None
    
    try:
        device_id = metrics_response["device_id"]
        device_channel = metrics_response["device_channel"]
        metrics = metrics_response["metrics"]
        
        # Validate metrics data
        if not isinstance(metrics, dict):
            logger.error(f"Invalid metrics data format for device {device_channel}: {type(metrics)}")
            return None
            
        # Check if created_at exists and has the correct format
        if "created_at" not in metrics:
            logger.error(f"Missing timestamp (created_at) in metrics for device {device_channel}")
            return None
            
        # Convert timestamp to Uganda timezone
        try:
            created_at = datetime.strptime(metrics["created_at"], "%Y-%m-%dT%H:%M:%SZ")
            created_at_utc = pytz.utc.localize(created_at)
            created_at_uganda = created_at_utc.astimezone(uganda_tz)
        except (ValueError, TypeError) as e:
            logger.error(f"Error parsing timestamp for device {device_channel}: {str(e)}")
            return None
        
        # Helper function to safely convert values to float
        def safe_float(value, default=None):
            if value is None:
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        # Extract metrics from the response with better error handling
        processed_data = {
            "device_id": device_id,
            "device_channel": device_channel,
            "timestamp": created_at_uganda,
            "pm2_5": safe_float(metrics.get("pm2_5")),
            "pm10": safe_float(metrics.get("pm10")),
            "s2_pm2_5": safe_float(metrics.get("s2_pm2_5")),
            "s2_pm10": safe_float(metrics.get("s2_pm10")),
            "latitude": safe_float(metrics.get("latitude")),
            "longitude": safe_float(metrics.get("longitude")),
            "battery": safe_float(metrics.get("battery")),
            "altitude": safe_float(metrics.get("altitude")),
            "speed": safe_float(metrics.get("speed")),
            "satellites": safe_float(metrics.get("satellites")),
            "hdop": safe_float(metrics.get("hdop")),
            "internal_temperature": safe_float(metrics.get("internalTemperature")),
            "internal_humidity": safe_float(metrics.get("internalHumidity")),
            "external_temperature": safe_float(metrics.get("externalTemperature")),
            "external_humidity": safe_float(metrics.get("ExternalHumidity")),
            "external_pressure": safe_float(metrics.get("ExternalPressure")),
            "external_altitude": safe_float(metrics.get("ExternalAltitude")),
            "device_type": metrics.get("DeviceType", ""),
            "raw_data": json.dumps(metrics)
        }
        
        return processed_data
    except Exception as e:
        logger.error(f"Error processing metrics data: {str(e)}")
        return None

def save_metrics_to_db(processed_data):
    """Save the processed metrics data to the database with improved error handling"""
    if not processed_data:
        return
    
    try:
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        conn = pg_hook.get_conn()
        conn.autocommit = False  # Use transactions for safety
        cursor = conn.cursor()
        
        try:
            # SQL for inserting metrics data
            sql = """
            INSERT INTO airqo_device_metrics (
                device_id, device_channel, timestamp, pm2_5, pm10, s2_pm2_5, s2_pm10,
                latitude, longitude, battery, altitude, speed, satellites, hdop,
                internal_temperature, internal_humidity, external_temperature, external_humidity,
                external_pressure, external_altitude, device_type, raw_data
            ) VALUES (
                %(device_id)s, %(device_channel)s, %(timestamp)s, %(pm2_5)s, %(pm10)s, %(s2_pm2_5)s, %(s2_pm10)s,
                %(latitude)s, %(longitude)s, %(battery)s, %(altitude)s, %(speed)s, %(satellites)s, %(hdop)s,
                %(internal_temperature)s, %(internal_humidity)s, %(external_temperature)s, %(external_humidity)s,
                %(external_pressure)s, %(external_altitude)s, %(device_type)s, %(raw_data)s
            )
            """
            
            cursor.execute(sql, processed_data)
            conn.commit()
            logger.info(f"Saved metrics for device {processed_data['device_channel']} to database")
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error while saving metrics: {str(e)}")
            raise
        finally:
            # Close database resources
            cursor.close()
            conn.close()
        
    except Exception as e:
        logger.error(f"Error in database connection: {str(e)}")
        raise e

def fetch_and_store_metrics():
    """Main function to fetch and store metrics for all deployed devices"""
    try:
        # Get all deployed devices
        deployed_devices = get_deployed_devices()
        
        if not deployed_devices:
            logger.warning("No deployed devices found in the database")
            return
            
        logger.info(f"Processing metrics for {len(deployed_devices)} deployed devices")
        
        # Track successful and failed devices
        successful_devices = 0
        failed_devices = 0
        
        # Process each device
        for device in deployed_devices:
            device_id, device_channel = device
            logger.info(f"Fetching metrics for device {device_channel}")
            
            try:
                # Fetch metrics
                metrics_response = fetch_device_metrics(device_id, device_channel)
                
                # Process metrics data
                processed_data = process_metrics_data(metrics_response)
                
                # Save to database
                if processed_data:
                    save_metrics_to_db(processed_data)
                    successful_devices += 1
                else:
                    logger.warning(f"No valid metrics data for device {device_channel}")
                    failed_devices += 1
                
                # Small delay between requests to avoid overwhelming the API
                import time
                time.sleep(1)
            except Exception as e:
                logger.error(f"Error processing device {device_channel}: {str(e)}")
                failed_devices += 1
                continue  # Continue with next device
        
        logger.info(f"Completed metrics collection. Successful: {successful_devices}, Failed: {failed_devices}")
    except Exception as e:
        logger.error(f"Error in fetch_and_store_metrics: {str(e)}")
        raise e

# Define the task for the DAG
fetch_metrics_task = PythonOperator(
    task_id='fetch_and_store_metrics',
    python_callable=fetch_and_store_metrics,
    dag=dag,
)

# Define task dependencies
create_metrics_table >> fetch_metrics_task