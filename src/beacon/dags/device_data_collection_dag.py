from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
import requests
import json
import pandas as pd
import os
from airflow.models import Variable
from datetime import datetime, timedelta, timezone
import pytz

# Try to load .env file if available
try:
    from dotenv import load_dotenv
    env_path = '/opt/airflow/.env'
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"Loaded environment from: {env_path}")
except ImportError:
    print("python-dotenv not installed. Using environment variables directly.")
except Exception as e:
    print(f"Error loading .env file: {e}")

# Function to get token safely
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


def fetch_device_metadata(**kwargs):
    """Fetch detailed metadata for all available devices"""
    airqo_token = get_airqo_token()
    
    # API endpoint for all devices
    url = f"https://api.airqo.net/api/v2/devices?token={airqo_token}"
    
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('success', False):
            devices = data.get('devices', [])
            print(f"Successfully fetched {len(devices)} devices from AirQo API")
            
            # Save all devices metadata
            with open('/tmp/airqo_all_devices.json', 'w') as f:
                json.dump(devices, f, indent=2)
            
            # Save to temporary CSV for next task
            if devices:
                device_df = pd.DataFrame(devices)
                device_df.to_csv('/tmp/airqo_active_devices.csv', index=False)
                print(f"Saved {len(device_df)} devices to CSV")

            return {
                'all_device_count': len(devices),
                'active_device_count': len([d for d in devices if d.get('isActive', False)]),
                'deployed_device_count': len([d for d in devices if d.get('status') == 'deployed']),
                'device_ids': [d.get('_id') for d in devices if d.get('_id')]
            }
        else:
            print(f"Warning: API returned success=false: {data.get('message', 'Unknown error')}")
            return {
                'all_device_count': 0,
                'active_device_count': 0,
                'deployed_device_count': 0,
                'device_ids': []
            }
    
    except Exception as e:
        print(f"Error fetching device metadata: {str(e)}")
        raise

def load_device_metadata_to_postgres(**kwargs):
    """
    Load device metadata to PostgreSQL with proper timezone handling for Kampala.
    """
    successful_devices = 0
    failed_devices = 0
    
    try:
        # Set Kampala timezone
        kampala_tz = pytz.timezone('Africa/Kampala')
        now_kampala = datetime.now(timezone.utc).astimezone(kampala_tz)
        
        # Check if active devices CSV exists
        if not os.path.exists('/tmp/airqo_active_devices.csv'):
            print("No active device data file found, skipping database load")
            return {
                'processed_devices': 0,
                'successful_devices': 0,
                'failed_devices': 0
            }
        
        device_df = pd.read_csv('/tmp/airqo_active_devices.csv', low_memory=False)
        
        # Handle any NaN values
        device_df = device_df.fillna({
            'isActive': False,
            'isOnline': False,
            'status': 'unknown',
            'network': 'unknown',
            'category': 'unknown'
        })
        
        if device_df.empty:
            print("No active device data found, skipping database load")
            return {
                'processed_devices': 0,
                'successful_devices': 0,
                'failed_devices': 0
            }
        
        print(f"Processing {len(device_df)} devices")
        pg_hook = PostgresHook(postgres_conn_id='postgres_default')
        
        # Process each device with individual transactions
        for idx, row in device_df.iterrows():
            conn = None
            cursor = None
            device_id = row.get('_id', 'unknown')
            
            try:
                # Create a new connection for each device to isolate transactions
                conn = pg_hook.get_conn()
                conn.autocommit = False
                cursor = conn.cursor()
                
                # Set the timezone for this database session
                cursor.execute("SET timezone = 'Africa/Kampala';")
                
                # Extract core metadata with proper null checking
                if not device_id or pd.isna(device_id):
                    print(f"Skipping row {idx} with missing device ID")
                    failed_devices += 1
                    continue
                    
                device_name = row.get('name', 'Unknown')
                is_active = bool(row.get('isActive', False))
                status = row.get('status', 'Unknown')
                is_online = bool(row.get('isOnline', False))
                
                # Handle optional fields with proper null handling
                network = row.get('network') if pd.notna(row.get('network')) else None
                category = row.get('category') if pd.notna(row.get('category')) else None
                mount_type = row.get('mountType') if pd.notna(row.get('mountType')) else None
                power_type = row.get('powerType') if pd.notna(row.get('powerType')) else None
                height = float(row.get('height')) if pd.notna(row.get('height')) else None
                
                # Handle timestamp fields with special care
                next_maintenance = None
                if 'nextMaintenance' in row and pd.notna(row['nextMaintenance']):
                    try:
                        next_maintenance_dt = pd.to_datetime(row['nextMaintenance'])
                        if pd.notna(next_maintenance_dt):
                            if next_maintenance_dt.tzinfo is None:
                                next_maintenance = next_maintenance_dt.tz_localize(timezone.utc).astimezone(kampala_tz)
                            else:
                                next_maintenance = next_maintenance_dt.astimezone(kampala_tz)
                    except Exception as e:
                        print(f"Warning: Could not parse nextMaintenance for device {device_id}: {e}")
                
                deployment_date = None
                if 'deployment_date' in row and pd.notna(row['deployment_date']):
                    try:
                        deployment_date_dt = pd.to_datetime(row['deployment_date'])
                        if pd.notna(deployment_date_dt):
                            if deployment_date_dt.tzinfo is None:
                                deployment_date = deployment_date_dt.tz_localize(timezone.utc).astimezone(kampala_tz)
                            else:
                                deployment_date = deployment_date_dt.astimezone(kampala_tz)
                    except Exception as e:
                        print(f"Warning: Could not parse deployment_date for device {device_id}: {e}")
                
                # Check if device exists
                cursor.execute("SELECT device_key FROM dim_device WHERE device_id = %s", (device_id,))
                result = cursor.fetchone()
                
                if result:
                    # Update existing device
                    device_key = result[0]
                    update_fields = [
                        "device_name = %s",
                        "is_active = %s",
                        "status = %s",
                        "is_online = %s", 
                        "last_updated = %s"
                    ]
                    update_values = [device_name, is_active, status, is_online, now_kampala]
                    
                    # Add optional fields if they exist
                    if network is not None:
                        update_fields.append("network = %s")
                        update_values.append(network)
                    
                    if category is not None:
                        update_fields.append("category = %s")
                        update_values.append(category)
                    
                    if mount_type is not None:
                        update_fields.append("mount_type = %s")
                        update_values.append(mount_type)
                    
                    if power_type is not None:
                        update_fields.append("power_type = %s")
                        update_values.append(power_type)
                    
                    if height is not None:
                        update_fields.append("height = %s")
                        update_values.append(height)
                    
                    if next_maintenance is not None:
                        update_fields.append("next_maintenance = %s")
                        update_values.append(next_maintenance)
                    
                    update_values.append(device_id)  # For WHERE clause
                    
                    update_sql = f"""
                        UPDATE dim_device 
                        SET {', '.join(update_fields)}
                        WHERE device_id = %s
                    """
                    
                    cursor.execute(update_sql, update_values)
                    
                else:
                    # Insert new device
                    insert_fields = ["device_id", "device_name", "is_active", "status", "is_online", "first_seen", "last_updated"]
                    insert_values = [device_id, device_name, is_active, status, is_online, now_kampala, now_kampala]
                    
                    # Add optional fields
                    if network is not None:
                        insert_fields.append("network")
                        insert_values.append(network)
                    
                    if category is not None:
                        insert_fields.append("category")
                        insert_values.append(category)
                    
                    if mount_type is not None:
                        insert_fields.append("mount_type")
                        insert_values.append(mount_type)
                    
                    if power_type is not None:
                        insert_fields.append("power_type")
                        insert_values.append(power_type)
                    
                    if height is not None:
                        insert_fields.append("height")
                        insert_values.append(height)
                    
                    if next_maintenance is not None:
                        insert_fields.append("next_maintenance")
                        insert_values.append(next_maintenance)
                    
                    placeholders = ", ".join(["%s"] * len(insert_values))
                    
                    insert_sql = f"""
                        INSERT INTO dim_device 
                        ({', '.join(insert_fields)})
                        VALUES ({placeholders})
                        RETURNING device_key
                    """
                    
                    cursor.execute(insert_sql, insert_values)
                    device_key = cursor.fetchone()[0]
                
                # Handle location data
                lat = row.get('latitude')
                lon = row.get('longitude')
                
                if pd.notna(lat) and pd.notna(lon):
                    try:
                        lat = float(lat)
                        lon = float(lon)
                        
                        # Extract site and grid information
                        site_id = None
                        site_name = None
                        location_name = None
                        search_name = None
                        village = None
                        site_category = None
                        admin_level_country = None
                        admin_level_city = None
                        admin_level_division = None
                        
                        # Parse site data if it exists
                        if 'site' in row and pd.notna(row['site']):
                            try:
                                if isinstance(row['site'], str):
                                    site_data = json.loads(row['site'])
                                else:
                                    site_data = row['site']
                                
                                if isinstance(site_data, dict):
                                    site_id = site_data.get('_id')
                                    site_name = site_data.get('name')
                                    location_name = site_data.get('location_name')
                                    search_name = site_data.get('search_name')
                                    village = site_data.get('village')
                                    
                                    if 'site_category' in site_data and isinstance(site_data['site_category'], dict):
                                        site_category = site_data['site_category'].get('category')
                            except (json.JSONDecodeError, TypeError) as e:
                                print(f"Warning: Could not parse site data for device {device_id}: {e}")
                        
                        # Parse grids data if it exists
                        if 'grids' in row and pd.notna(row['grids']):
                            try:
                                if isinstance(row['grids'], str):
                                    grids_data = json.loads(row['grids'])
                                else:
                                    grids_data = row['grids']
                                
                                if isinstance(grids_data, list):
                                    for grid in grids_data:
                                        if isinstance(grid, dict):
                                            admin_level = grid.get('admin_level')
                                            if admin_level == 'country':
                                                admin_level_country = grid.get('long_name')
                                            elif admin_level == 'city':
                                                if admin_level_city is None or (grid.get('long_name', '').startswith('Greater') and not admin_level_city.startswith('Greater')):
                                                    admin_level_city = grid.get('long_name')
                                            elif admin_level == 'division':
                                                admin_level_division = grid.get('long_name')
                            except (json.JSONDecodeError, TypeError) as e:
                                print(f"Warning: Could not parse grids data for device {device_id}: {e}")
                        
                        # Check if active location exists for this device
                        cursor.execute(
                            "SELECT location_key FROM dim_location WHERE device_key = %s AND is_active = true", 
                            (device_key,)
                        )
                        location_result = cursor.fetchone()
                        
                        if location_result:
                            # Deactivate existing location
                            cursor.execute(
                                """
                                UPDATE dim_location
                                SET effective_to = %s, is_active = false
                                WHERE device_key = %s AND is_active = true
                                """,
                                (now_kampala, device_key)
                            )
                        
                        # Insert new location record
                        location_fields = [
                            "device_key", "latitude", "longitude", "effective_from", 
                            "recorded_at", "is_active"
                        ]
                        location_values = [device_key, lat, lon, now_kampala, now_kampala, True]
                        
                        # Add optional location fields
                        optional_fields = {
                            'site_id': site_id,
                            'site_name': site_name,
                            'location_name': location_name,
                            'search_name': search_name,
                            'village': village,
                            'site_category': site_category,
                            'admin_level_country': admin_level_country,
                            'admin_level_city': admin_level_city,
                            'admin_level_division': admin_level_division,
                            'mount_type': mount_type,
                            'power_type': power_type,
                            'deployment_date': deployment_date
                        }
                        
                        for field, value in optional_fields.items():
                            if value is not None:
                                location_fields.append(field)
                                location_values.append(value)
                        
                        placeholders = ", ".join(["%s"] * len(location_values))
                        
                        location_sql = f"""
                            INSERT INTO dim_location
                            ({', '.join(location_fields)})
                            VALUES ({placeholders})
                        """
                        
                        cursor.execute(location_sql, location_values)
                        
                    except (ValueError, TypeError) as e:
                        print(f"Warning: Invalid coordinates for device {device_id}: lat={lat}, lon={lon}, error={e}")
                
                # Record current device status
                cursor.execute(
                    """
                    INSERT INTO fact_device_status 
                    (device_key, timestamp, is_online, device_status)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (device_key, now_kampala, is_online, status)
                )
                
                # Commit the transaction for this device
                conn.commit()
                successful_devices += 1
                
                if successful_devices % 50 == 0:  # Progress indicator
                    print(f"Successfully processed {successful_devices} devices...")
                
            except Exception as e:
                # Roll back transaction on error
                if conn:
                    try:
                        conn.rollback()
                    except Exception as rollback_error:
                        print(f"Rollback error for device {device_id}: {str(rollback_error)}")
                
                print(f"Error processing device {device_id}: {str(e)}")
                failed_devices += 1
                
            finally:
                # Always close cursor and connection
                if cursor:
                    cursor.close()
                if conn:
                    conn.close()
        
        print(f"Device processing complete. Success: {successful_devices}, Failed: {failed_devices}")
        
        return {
            "processed_devices": len(device_df),
            "successful_devices": successful_devices,
            "failed_devices": failed_devices
        }
        
    except Exception as e:
        print(f"Critical error in device metadata loading: {str(e)}")
        raise

def print_env_vars(**kwargs):
    """Print environment variables for debugging"""
    try:
        token = get_airqo_token()
        print(f"Successfully retrieved token (first 4 chars): {token[:4]}..." if token else "No token found")
        return token
    except Exception as e:
        print(f"Error getting token: {e}")
        raise

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'airqo_device_metadata_loader',
    default_args=default_args,
    description='Load all device metadata from AirQo API into PostgreSQL',
    schedule_interval=timedelta(hours=6),
    start_date=datetime(2025, 3, 1),
    catchup=False,
    tags=['airqo', 'iot', 'device-metadata'],
    max_active_runs=1,  # Prevent concurrent runs
) as dag:

    # Test environment variables
    test_env_vars = PythonOperator(
        task_id='test_env_vars',
        python_callable=print_env_vars,
    )
    
    # Database setup task
    setup_tables = PostgresOperator(
        task_id='setup_tables',
        postgres_conn_id='postgres_default',
        sql="""
        -- Set timezone to Africa/Kampala for this session
        SET timezone = 'Africa/Kampala';
        
        -- Create dim_device table
        CREATE TABLE IF NOT EXISTS dim_device (
            device_key SERIAL PRIMARY KEY,
            device_id VARCHAR(100) UNIQUE NOT NULL,
            device_name VARCHAR(100),
            network VARCHAR(50),
            category VARCHAR(50),
            is_active BOOLEAN DEFAULT FALSE,
            status VARCHAR(50),
            is_online BOOLEAN DEFAULT FALSE,
            mount_type VARCHAR(50),
            power_type VARCHAR(50),
            height FLOAT,
            next_maintenance TIMESTAMP WITH TIME ZONE,
            first_seen TIMESTAMP WITH TIME ZONE,
            last_updated TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create dim_location table
        CREATE TABLE IF NOT EXISTS dim_location (
            location_key SERIAL PRIMARY KEY,
            device_key INTEGER REFERENCES dim_device(device_key) ON DELETE CASCADE,
            location_name VARCHAR(255),
            search_name VARCHAR(255),
            village VARCHAR(255),
            latitude FLOAT NOT NULL,
            longitude FLOAT NOT NULL,
            admin_level_country VARCHAR(100),
            admin_level_city VARCHAR(100),
            admin_level_division VARCHAR(100),
            site_category VARCHAR(100),
            mount_type VARCHAR(50),
            power_type VARCHAR(50),
            site_id VARCHAR(100),
            site_name VARCHAR(255),
            deployment_date TIMESTAMP WITH TIME ZONE,
            effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
            effective_to TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN DEFAULT TRUE,
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create fact_device_status table
        CREATE TABLE IF NOT EXISTS fact_device_status (
            status_key SERIAL PRIMARY KEY,
            device_key INTEGER REFERENCES dim_device(device_key) ON DELETE CASCADE,
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            is_online BOOLEAN,
            device_status VARCHAR(50)
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_dim_device_device_id ON dim_device(device_id);
        CREATE INDEX IF NOT EXISTS idx_dim_device_status ON dim_device(status);
        CREATE INDEX IF NOT EXISTS idx_dim_device_active ON dim_device(is_active);
        CREATE INDEX IF NOT EXISTS idx_dim_device_online ON dim_device(is_online);
        
        CREATE INDEX IF NOT EXISTS idx_dim_location_device_key ON dim_location(device_key);
        CREATE INDEX IF NOT EXISTS idx_dim_location_active ON dim_location(is_active);
        CREATE INDEX IF NOT EXISTS idx_dim_location_coords ON dim_location(latitude, longitude);
        
        CREATE INDEX IF NOT EXISTS idx_fact_device_status_device_key ON fact_device_status(device_key);
        CREATE INDEX IF NOT EXISTS idx_fact_device_status_timestamp ON fact_device_status(timestamp);
        """
    )
    
    # Fetch device metadata
    fetch_device_metadata_task = PythonOperator(
        task_id='fetch_device_metadata',
        python_callable=fetch_device_metadata,
    )
    
    # Load device metadata to PostgreSQL
    load_metadata_task = PythonOperator(
        task_id='load_device_metadata',
        python_callable=load_device_metadata_to_postgres,
    )
    
    # Cleanup temporary files
    cleanup_task = BashOperator(
        task_id='cleanup_temp_files',
        bash_command='rm -f /tmp/airqo_*.csv /tmp/airqo_*.json',
    )
    
    # Define task dependencies - simplified linear flow
    test_env_vars >> setup_tables >> fetch_device_metadata_task >> load_metadata_task >> cleanup_task