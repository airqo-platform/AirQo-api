from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.models import Variable
import requests
import json
import os
import pandas as pd
import logging


logger = logging.getLogger(__name__)

# Default arguments for the DAG
default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=2),
}

def fetch_devices_data(**kwargs):
    """Fetch all device data from the API"""
    
    # Use the FastAPI service name from your docker-compose setup
    api_url = "http://airqo-device-monitoring-system-fastapi-1:8000/devices-detail"
    
    logger.info(f"Fetching devices data from {api_url}")
    
    try:
        response = requests.get(
            api_url,
            headers={
                'Accept': 'application/json'
            }
        )
        response.raise_for_status()
        
        devices_data = response.json()
        logger.info(f"Successfully fetched data for {devices_data.get('count', 0)} devices")
        
        # Store in XCom for downstream tasks
        return devices_data
    
    except Exception as e:
        logger.error(f"Error fetching devices data: {str(e)}")
        raise

def process_regional_analysis(**kwargs):
    """Process device data for regional analysis"""
    ti = kwargs['ti']
    devices_data = ti.xcom_pull(task_ids='fetch_devices_data')
    
    if not devices_data or 'devices' not in devices_data:
        logger.warning("No devices data available for regional analysis")
        return {}
    
    # Define African regions
    regions = {
        "East Africa": ["Kenya", "Uganda", "Tanzania", "Rwanda", "Burundi", "South Sudan", "Ethiopia", "Somalia", "Djibouti", "Eritrea"],
        "West Africa": ["Nigeria", "Ghana", "Ivory Coast", "Senegal", "Mali", "Guinea", "Burkina Faso", "Benin", "Togo", "Sierra Leone", 
                        "Liberia", "Guinea-Bissau", "Gambia", "Niger", "Cape Verde", "Mauritania"],
        "North Africa": ["Egypt", "Morocco", "Algeria", "Tunisia", "Libya", "Sudan"],
        "Southern Africa": ["South Africa", "Namibia", "Botswana", "Zimbabwe", "Mozambique", "Zambia", "Malawi", "Angola", "Lesotho", "Eswatini"],
        "Central Africa": ["DR Congo", "Cameroon", "Central African Republic", "Chad", "Republic of Congo", "Gabon", "Equatorial Guinea", "São Tomé and Príncipe"],
        "Indian Ocean": ["Madagascar", "Mauritius", "Seychelles", "Comoros"]
    }
    
    # Initialize regional data structure
    regional_data = {region: {
        "region": region,
        "deviceCount": 0,
        "onlineDevices": 0,
        "offlineDevices": 0,
        "countries": set(),
        "districts": set(),
        "pm25_sum": 0,
        "pm10_sum": 0,
        "pm25_count": 0,
        "pm10_count": 0,
        "uptime_sum": 0,
        "uptime_count": 0,
        "dataCompleteness_sum": 0,
        "dataCompleteness_count": 0,
        "aqiGood": 0,
        "aqiModerate": 0,
        "aqiUhfsg": 0, # Unhealthy for Sensitive Groups
        "aqiUnhealthy": 0,
        "aqiVeryUnhealthy": 0,
        "aqiHazardous": 0,
    } for region in regions.keys()}
    
    # Process each device
    for device in devices_data['devices']:
        country = device['location'].get('country')
        if not country:
            continue
            
        # Find which region this country belongs to
        device_region = None
        for region, countries in regions.items():
            if country in countries:
                device_region = region
                break
        
        if not device_region:
            logger.warning(f"Country {country} not mapped to any region, skipping")
            continue
            
        # Update region data
        regional_data[device_region]["deviceCount"] += 1
        
        # Update online/offline count
        if device['device'].get('is_online'):
            regional_data[device_region]["onlineDevices"] += 1
        else:
            regional_data[device_region]["offlineDevices"] += 1
            
        # Add country and district
        regional_data[device_region]["countries"].add(country)
        
        district = device['location'].get('division') or device['location'].get('city')
        if district:
            regional_data[device_region]["districts"].add(district)
            
        # Add PM2.5 and PM10 data
        latest_reading = device.get('latest_reading', {})
        if latest_reading.get('pm2_5') is not None:
            regional_data[device_region]["pm25_sum"] += latest_reading['pm2_5']
            regional_data[device_region]["pm25_count"] += 1
            
        if latest_reading.get('pm10') is not None:
            regional_data[device_region]["pm10_sum"] += latest_reading['pm10']
            regional_data[device_region]["pm10_count"] += 1
            
        # Add uptime data if available
        if device['device'].get('uptime') is not None:
            regional_data[device_region]["uptime_sum"] += device['device']['uptime']
            regional_data[device_region]["uptime_count"] += 1
            
        # Add data completeness if available
        if device['device'].get('data_completeness') is not None:
            regional_data[device_region]["dataCompleteness_sum"] += device['device']['data_completeness']
            regional_data[device_region]["dataCompleteness_count"] += 1
            
        # Process AQI category
        aqi_category = latest_reading.get('aqi_category', '').lower()
        if 'good' in aqi_category:
            regional_data[device_region]["aqiGood"] += 1
        elif 'moderate' in aqi_category:
            regional_data[device_region]["aqiModerate"] += 1
        elif 'sensitive' in aqi_category:
            regional_data[device_region]["aqiUhfsg"] += 1
        elif 'unhealthy' in aqi_category and 'very' not in aqi_category:
            regional_data[device_region]["aqiUnhealthy"] += 1
        elif 'very unhealthy' in aqi_category:
            regional_data[device_region]["aqiVeryUnhealthy"] += 1
        elif 'hazardous' in aqi_category:
            regional_data[device_region]["aqiHazardous"] += 1
    
    # Calculate averages and convert sets to counts
    regional_summary = []
    for region, data in regional_data.items():
        # Convert sets to counts
        data["countries"] = len(data["countries"])
        data["districts"] = len(data["districts"])
        
        # Calculate averages
        data["pm25"] = data["pm25_sum"] / data["pm25_count"] if data["pm25_count"] > 0 else None
        data["pm10"] = data["pm10_sum"] / data["pm10_count"] if data["pm10_count"] > 0 else None
        data["uptime"] = data["uptime_sum"] / data["uptime_count"] if data["uptime_count"] > 0 else None
        data["dataCompleteness"] = data["dataCompleteness_sum"] / data["dataCompleteness_count"] if data["dataCompleteness_count"] > 0 else None
        
        # Calculate data transmission rate based on online devices
        if data["deviceCount"] > 0:
            data["dataTransmissionRate"] = (data["onlineDevices"] / data["deviceCount"]) * 100
        else:
            data["dataTransmissionRate"] = None
        
        # Remove temporary calculation fields
        for field in ["pm25_sum", "pm10_sum", "pm25_count", "pm10_count", "uptime_sum", "uptime_count", "dataCompleteness_sum", "dataCompleteness_count"]:
            if field in data:
                del data[field]
                
        regional_summary.append(data)
    
    # Store the results
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    connection = pg_hook.get_conn()
    cursor = connection.cursor()
    
    try:
        # Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS network_analysis_regional (
                id SERIAL PRIMARY KEY,
                region VARCHAR(100) NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert new data
        for region_data in regional_summary:
            cursor.execute(
                """
                INSERT INTO network_analysis_regional (region, data)
                VALUES (%s, %s)
                """,
                (region_data["region"], json.dumps(region_data))
            )
        
        connection.commit()
        logger.info(f"Successfully stored regional analysis data for {len(regional_summary)} regions")
        
    except Exception as e:
        connection.rollback()
        logger.error(f"Error storing regional analysis: {str(e)}")
        raise
    finally:
        cursor.close()
        connection.close()
    
    return regional_summary

def process_country_analysis(**kwargs):
    """Process device data for country analysis"""
    ti = kwargs['ti']
    devices_data = ti.xcom_pull(task_ids='fetch_devices_data')
    
    if not devices_data or 'devices' not in devices_data:
        logger.warning("No devices data available for country analysis")
        return {}
    
    # Initialize country data structure
    country_data = {}
    
    # Process each device
    for device in devices_data['devices']:
        country = device['location'].get('country')
        if not country:
            continue
            
        # Create country entry if it doesn't exist
        if country not in country_data:
            country_data[country] = {
                "name": country,
                "region": get_region_for_country(country),
                "devices": 0,
                "onlineDevices": 0,
                "offlineDevices": 0,
                "districts": set(),
                "pm25_sum": 0,
                "pm10_sum": 0,
                "pm25_count": 0,
                "pm10_count": 0,
                "uptime_sum": 0,
                "uptime_count": 0,
                "dataCompleteness_sum": 0,
                "dataCompleteness_count": 0,
                "aqiGood": 0,
                "aqiModerate": 0,
                "aqiUhfsg": 0,
                "aqiUnhealthy": 0,
                "aqiVeryUnhealthy": 0,
                "aqiHazardous": 0,
                "devicesList": []
            }
        
        # Update country data
        country_data[country]["devices"] += 1
        
        # Update online/offline count
        if device['device'].get('is_online'):
            country_data[country]["onlineDevices"] += 1
        else:
            country_data[country]["offlineDevices"] += 1
            
        # Add district
        district = device['location'].get('division') or device['location'].get('city')
        if district:
            country_data[country]["districts"].add(district)
            
        # Add PM2.5 and PM10 data
        latest_reading = device.get('latest_reading', {})
        if latest_reading.get('pm2_5') is not None:
            country_data[country]["pm25_sum"] += latest_reading['pm2_5']
            country_data[country]["pm25_count"] += 1
            
        if latest_reading.get('pm10') is not None:
            country_data[country]["pm10_sum"] += latest_reading['pm10']
            country_data[country]["pm10_count"] += 1
            
        # Add uptime data if available
        if device['device'].get('uptime') is not None:
            country_data[country]["uptime_sum"] += device['device']['uptime']
            country_data[country]["uptime_count"] += 1
            
        # Add data completeness if available
        if device['device'].get('data_completeness') is not None:
            country_data[country]["dataCompleteness_sum"] += device['device']['data_completeness']
            country_data[country]["dataCompleteness_count"] += 1
            
        # Process AQI category
        aqi_category = latest_reading.get('aqi_category', '').lower()
        if 'good' in aqi_category:
            country_data[country]["aqiGood"] += 1
        elif 'moderate' in aqi_category:
            country_data[country]["aqiModerate"] += 1
        elif 'sensitive' in aqi_category:
            country_data[country]["aqiUhfsg"] += 1
        elif 'unhealthy' in aqi_category and 'very' not in aqi_category:
            country_data[country]["aqiUnhealthy"] += 1
        elif 'very unhealthy' in aqi_category:
            country_data[country]["aqiVeryUnhealthy"] += 1
        elif 'hazardous' in aqi_category:
            country_data[country]["aqiHazardous"] += 1
            
        # Add device to the devices list
        device_info = {
            "id": device['device'].get('id'),
            "name": device['device'].get('name'),
            "status": device['device'].get('is_online', False),
            "lastUpdate": latest_reading.get('timestamp'),
            "pm25": latest_reading.get('pm2_5'),
            "pm10": latest_reading.get('pm10')
        }
        
        # Only add battery level if available
        if device['device'].get('battery_level') is not None:
            device_info["batteryLevel"] = device['device']['battery_level']
            
        # Only add signal strength if available
        if device['device'].get('signal_strength') is not None:
            device_info["signalStrength"] = device['device']['signal_strength']
            
        country_data[country]["devicesList"].append(device_info)
    
    # Calculate averages and convert sets to counts
    country_summary = []
    for country_name, data in country_data.items():
        # Convert sets to counts
        data["districts"] = len(data["districts"])
        
        # Calculate averages
        data["pm25"] = data["pm25_sum"] / data["pm25_count"] if data["pm25_count"] > 0 else None
        data["pm10"] = data["pm10_sum"] / data["pm10_count"] if data["pm10_count"] > 0 else None
        data["uptime"] = data["uptime_sum"] / data["uptime_count"] if data["uptime_count"] > 0 else None
        data["dataCompleteness"] = data["dataCompleteness_sum"] / data["dataCompleteness_count"] if data["dataCompleteness_count"] > 0 else None
        
        # Calculate data transmission rate
        if data["devices"] > 0:
            data["dataTransmissionRate"] = (data["onlineDevices"] / data["devices"]) * 100
        else:
            data["dataTransmissionRate"] = None
        
        # Remove temporary calculation fields
        for field in ["pm25_sum", "pm10_sum", "pm25_count", "pm10_count", "uptime_sum", "uptime_count", "dataCompleteness_sum", "dataCompleteness_count"]:
            if field in data:
                del data[field]
                
        country_summary.append(data)
    
    # Store the results
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    connection = pg_hook.get_conn()
    cursor = connection.cursor()
    
    try:
        # Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS network_analysis_country (
                id SERIAL PRIMARY KEY,
                country VARCHAR(100) NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert new data
        for country_data in country_summary:
            cursor.execute(
                """
                INSERT INTO network_analysis_country (country, data)
                VALUES (%s, %s)
                """,
                (country_data["name"], json.dumps(country_data))
            )
        
        connection.commit()
        logger.info(f"Successfully stored country analysis data for {len(country_summary)} countries")
        
    except Exception as e:
        connection.rollback()
        logger.error(f"Error storing country analysis: {str(e)}")
        raise
    finally:
        cursor.close()
        connection.close()
    
    return country_summary

def process_district_analysis(**kwargs):
    """Process device data for district analysis"""
    ti = kwargs['ti']
    devices_data = ti.xcom_pull(task_ids='fetch_devices_data')
    
    if not devices_data or 'devices' not in devices_data:
        logger.warning("No devices data available for district analysis")
        return {}
    
    # Initialize district data structure
    district_data = {}
    
    # Process each device
    for device in devices_data['devices']:
        country = device['location'].get('country')
        district = device['location'].get('division') or device['location'].get('city')
        if not country or not district:
            continue
            
        # Create district key
        district_key = f"{district}_{country}"
            
        # Create district entry if it doesn't exist
        if district_key not in district_data:
            district_data[district_key] = {
                "name": district,
                "country": country,
                "region": get_region_for_country(country),
                "devices": 0,
                "onlineDevices": 0,
                "offlineDevices": 0,
                "pm25_sum": 0,
                "pm10_sum": 0,
                "pm25_count": 0,
                "pm10_count": 0,
                "uptime_sum": 0,
                "uptime_count": 0,
                "dataCompleteness_sum": 0,
                "dataCompleteness_count": 0,
                "aqiGood": 0,
                "aqiModerate": 0,
                "aqiUhfsg": 0,
                "aqiUnhealthy": 0,
                "aqiVeryUnhealthy": 0,
                "aqiHazardous": 0,
                "devicesList": []
            }
        
        # Update district data
        district_data[district_key]["devices"] += 1
        
        # Update online/offline count
        if device['device'].get('is_online'):
            district_data[district_key]["onlineDevices"] += 1
        else:
            district_data[district_key]["offlineDevices"] += 1
            
        # Add PM2.5 and PM10 data
        latest_reading = device.get('latest_reading', {})
        if latest_reading.get('pm2_5') is not None:
            district_data[district_key]["pm25_sum"] += latest_reading['pm2_5']
            district_data[district_key]["pm25_count"] += 1
            
        if latest_reading.get('pm10') is not None:
            district_data[district_key]["pm10_sum"] += latest_reading['pm10']
            district_data[district_key]["pm10_count"] += 1
            
        # Add uptime data if available
        if device['device'].get('uptime') is not None:
            district_data[district_key]["uptime_sum"] += device['device']['uptime']
            district_data[district_key]["uptime_count"] += 1
            
        # Add data completeness if available
        if device['device'].get('data_completeness') is not None:
            district_data[district_key]["dataCompleteness_sum"] += device['device']['data_completeness']
            district_data[district_key]["dataCompleteness_count"] += 1
            
        # Process AQI category
        aqi_category = latest_reading.get('aqi_category', '').lower()
        if 'good' in aqi_category:
            district_data[district_key]["aqiGood"] += 1
        elif 'moderate' in aqi_category:
            district_data[district_key]["aqiModerate"] += 1
        elif 'sensitive' in aqi_category:
            district_data[district_key]["aqiUhfsg"] += 1
        elif 'unhealthy' in aqi_category and 'very' not in aqi_category:
            district_data[district_key]["aqiUnhealthy"] += 1
        elif 'very unhealthy' in aqi_category:
            district_data[district_key]["aqiVeryUnhealthy"] += 1
        elif 'hazardous' in aqi_category:
            district_data[district_key]["aqiHazardous"] += 1
            
        # Add device to the devices list
        device_info = {
            "id": device['device'].get('id'),
            "name": device['device'].get('name'),
            "status": device['device'].get('is_online', False),
            "lastUpdate": latest_reading.get('timestamp'),
            "pm25": latest_reading.get('pm2_5'),
            "pm10": latest_reading.get('pm10')
        }
        
        # Only add battery level if available
        if device['device'].get('battery_level') is not None:
            device_info["batteryLevel"] = device['device']['battery_level']
            
        # Only add signal strength if available
        if device['device'].get('signal_strength') is not None:
            device_info["signalStrength"] = device['device']['signal_strength']
            
        district_data[district_key]["devicesList"].append(device_info)
    
    # Calculate averages and convert sets to counts
    district_summary = []
    for district_key, data in district_data.items():
        # Calculate averages
        data["pm25"] = data["pm25_sum"] / data["pm25_count"] if data["pm25_count"] > 0 else None
        data["pm10"] = data["pm10_sum"] / data["pm10_count"] if data["pm10_count"] > 0 else None
        data["uptime"] = data["uptime_sum"] / data["uptime_count"] if data["uptime_count"] > 0 else None
        data["dataCompleteness"] = data["dataCompleteness_sum"] / data["dataCompleteness_count"] if data["dataCompleteness_count"] > 0 else None
        
        # Calculate data transmission rate
        if data["devices"] > 0:
            data["dataTransmissionRate"] = (data["onlineDevices"] / data["devices"]) * 100
        else:
            data["dataTransmissionRate"] = None
        
        # Remove temporary calculation fields
        for field in ["pm25_sum", "pm10_sum", "pm25_count", "pm10_count", "uptime_sum", "uptime_count", "dataCompleteness_sum", "dataCompleteness_count"]:
            if field in data:
                del data[field]
                
        district_summary.append(data)
    
    # Store the results
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    connection = pg_hook.get_conn()
    cursor = connection.cursor()
    
    try:
        # Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS network_analysis_district (
                id SERIAL PRIMARY KEY,
                district VARCHAR(100) NOT NULL,
                country VARCHAR(100) NOT NULL,
                data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert new data
        for district_data in district_summary:
            cursor.execute(
                """
                INSERT INTO network_analysis_district (district, country, data)
                VALUES (%s, %s, %s)
                """,
                (district_data["name"], district_data["country"], json.dumps(district_data))
            )
        
        connection.commit()
        logger.info(f"Successfully stored district analysis data for {len(district_summary)} districts")
        
    except Exception as e:
        connection.rollback()
        logger.error(f"Error storing district analysis: {str(e)}")
        raise
    finally:
        cursor.close()
        connection.close()
    
    return district_summary

def get_region_for_country(country):
    """Helper function to map a country to its region"""
    regions_map = {
        "East Africa": ["Kenya", "Uganda", "Tanzania", "Rwanda", "Burundi", "South Sudan", "Ethiopia", "Somalia", "Djibouti", "Eritrea"],
        "West Africa": ["Nigeria", "Ghana", "Ivory Coast", "Senegal", "Mali", "Guinea", "Burkina Faso", "Benin", "Togo", "Sierra Leone", 
                        "Liberia", "Guinea-Bissau", "Gambia", "Niger", "Cape Verde", "Mauritania"],
        "North Africa": ["Egypt", "Morocco", "Algeria", "Tunisia", "Libya", "Sudan"],
        "Southern Africa": ["South Africa", "Namibia", "Botswana", "Zimbabwe", "Mozambique", "Zambia", "Malawi", "Angola", "Lesotho", "Eswatini"],
        "Central Africa": ["DR Congo", "Cameroon", "Central African Republic", "Chad", "Republic of Congo", "Gabon", "Equatorial Guinea", "São Tomé and Príncipe"],
        "Indian Ocean": ["Madagascar", "Mauritius", "Seychelles", "Comoros"]
    }
    
    for region, countries in regions_map.items():
        if country in countries:
            return region
    
    return "Other"

with DAG(
    'network_analysis_pipeline',
    default_args=default_args,
    description='Process network analytics for region, country, and district levels',
    schedule_interval=timedelta(hours=1),
    start_date=datetime(2025, 4, 1),
    catchup=False,
    tags=['airqo', 'network', 'analysis', 'api'],
) as dag:

    setup_tables = PostgresOperator(
        task_id='setup_tables',
        postgres_conn_id='postgres_default',
        sql="""
        -- Regional analysis table
        CREATE TABLE IF NOT EXISTS network_analysis_regional (
            id SERIAL PRIMARY KEY,
            region VARCHAR(100) NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Country analysis table
        CREATE TABLE IF NOT EXISTS network_analysis_country (
            id SERIAL PRIMARY KEY,
            country VARCHAR(100) NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- District analysis table
        CREATE TABLE IF NOT EXISTS network_analysis_district (
            id SERIAL PRIMARY KEY,
            district VARCHAR(100) NOT NULL,
            country VARCHAR(100) NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_network_regional_region 
        ON network_analysis_regional(region);
        
        CREATE INDEX IF NOT EXISTS idx_network_country_country 
        ON network_analysis_country(country);
        
        CREATE INDEX IF NOT EXISTS idx_network_district_district_country 
        ON network_analysis_district(district, country);
        
        -- Create history retention - keep only last 30 days
        DELETE FROM network_analysis_regional 
        WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '30 days');
        
        DELETE FROM network_analysis_country 
        WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '30 days');
        
        DELETE FROM network_analysis_district 
        WHERE created_at < (CURRENT_TIMESTAMP - INTERVAL '30 days');
        """
    )
    
    fetch_data_task = PythonOperator(
        task_id='fetch_devices_data',
        python_callable=fetch_devices_data,
    )
    
    regional_analysis_task = PythonOperator(
        task_id='process_regional_analysis',
        python_callable=process_regional_analysis,
    )
    
    country_analysis_task = PythonOperator(
        task_id='process_country_analysis',
        python_callable=process_country_analysis,
    )
    
    district_analysis_task = PythonOperator(
        task_id='process_district_analysis',
        python_callable=process_district_analysis,
    )
    
    # Define task dependencies
    setup_tables >> fetch_data_task
    fetch_data_task >> regional_analysis_task
    fetch_data_task >> country_analysis_task
    fetch_data_task >> district_analysis_task