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


def get_site_ids(**kwargs):
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')

    site_query = """
    SELECT site_id FROM dim_site 
    WHERE site_id IS NOT NULL
    """

    connection = pg_hook.get_conn()
    cursor = connection.cursor()
    cursor.execute(site_query)
    site_ids = [row[0] for row in cursor.fetchall()]
    cursor.close()
    connection.close()

    logger.info(f"Found {len(site_ids)} sites")
    return site_ids


def fetch_site_measurements(site_id, **kwargs):
    token = get_airqo_token()
    api_url = f"https://api.airqo.net/api/v2/devices/measurements/sites/{site_id}/recent?token={token}"

    logger.info(f"Starting API request for site {site_id} at {datetime.now().isoformat()}")
    start_time = time.time()

    for attempt in range(3):
        try:
            logger.info(f"Attempt {attempt + 1}/3 for site {site_id}")
            session = requests.Session()
            response = session.get(
                api_url,
                timeout=90,
                headers={
                    'User-Agent': 'AirQo-Data-Pipeline/1.0',
                    'Accept': 'application/json'
                }
            )

            elapsed = time.time() - start_time
            logger.info(f"Request completed in {elapsed:.2f} seconds with status code {response.status_code}")
            response.raise_for_status()
            data = response.json()

            if not data.get('success', False):
                logger.warning(f"API returned success=false for site {site_id}: {data.get('message', 'Unknown error')}")
                return None

            measurements = data.get('measurements', [])
            logger.info(f"Received {len(measurements)} measurements for site {site_id}")

            return {
                'site_id': site_id,
                'data': data
            }

        except requests.exceptions.Timeout:
            elapsed = time.time() - start_time
            logger.warning(f"Timeout error (attempt {attempt + 1}/3) after {elapsed:.2f} seconds")
            if attempt < 2:
                time.sleep(5)

        except Exception as e:
            logger.error(f"Error fetching measurements for site {site_id}: {type(e).__name__}: {str(e)}")
            return None

    logger.error(f"Failed to fetch measurements for site {site_id} after 3 attempts")
    return None


def process_all_sites(**kwargs):
    ti = kwargs['ti']
    site_ids = ti.xcom_pull(task_ids='get_site_ids')

    if not site_ids:
        logger.warning("No site IDs found. Skipping measurements collection.")
        return []

    measurements_by_site = []

    for i, site_id in enumerate(site_ids):
        logger.info(f"Processing site {i + 1}/{len(site_ids)}: {site_id}")
        measurements = fetch_site_measurements(site_id)

        if measurements and measurements.get('data'):
            measurements_by_site.append(measurements)
            logger.info(f"Successfully processed site {site_id}")
        else:
            logger.warning(f"Failed to process site {site_id}")

        if i < len(site_ids) - 1:
            time.sleep(3)

    logger.info(f"Successfully fetched measurements for {len(measurements_by_site)} out of {len(site_ids)} sites")
    return measurements_by_site


def store_site_measurements(**kwargs):
    ti = kwargs['ti']
    all_measurements = ti.xcom_pull(task_ids='process_all_sites')

    if not all_measurements:
        logger.warning("No measurements to store. Skipping.")
        return

    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    connection = pg_hook.get_conn()

    inserted_count = 0
    skipped_count = 0

    try:
        for site_data in all_measurements:
            site_id = site_data['site_id']
            response_data = site_data['data']
            measurements = response_data.get('measurements', [])

            cursor = connection.cursor()
            try:
                cursor.execute("SELECT site_key FROM dim_site WHERE site_id = %s", (site_id,))
                result = cursor.fetchone()

                if not result:
                    logger.warning(f"Site {site_id} not found in dim_site table. Skipping.")
                    skipped_count += len(measurements)
                    continue

                site_key = result[0]

                for measurement in measurements:
                    try:
                        timestamp_str = measurement.get('time')
                        if not timestamp_str:
                            continue

                        # Parse timestamp from string
                        try:
                            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        except ValueError:
                            try:
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%S.%fZ")
                            except ValueError:
                                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")

                        pm2_5 = measurement.get('pm2_5', {}).get('value')
                        pm10 = measurement.get('pm10', {}).get('value')
                        no2 = measurement.get('no2', {}).get('value')
                        device_id = measurement.get('device_id')
                        device_name = measurement.get('device')
                        frequency = measurement.get('frequency')
                        is_reading_primary = measurement.get('is_reading_primary', False)
                        aqi_category = measurement.get('aqi_category')
                        aqi_color = measurement.get('aqi_color')
                        aqi_color_name = measurement.get('aqi_color_name')
                        time_difference_hours = measurement.get('timeDifferenceHours')

                        device_key = None
                        if device_id:
                            cursor.execute("SELECT device_key FROM dim_device WHERE device_id = %s", (device_id,))
                            device_result = cursor.fetchone()
                            if device_result:
                                device_key = device_result[0]

                        cursor.execute(
                            "SELECT 1 FROM fact_site_readings WHERE site_key = %s AND timestamp = %s LIMIT 1",
                            (site_key, timestamp)
                        )

                        if cursor.fetchone():
                            skipped_count += 1
                            continue

                        cursor.execute(
                            """
                            INSERT INTO fact_site_readings 
                            (site_key, device_key, timestamp, pm2_5, pm10, no2, device_id, device_name, 
                            frequency, is_reading_primary, aqi_category, aqi_color, aqi_color_name, time_difference_hours)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING reading_key
                            """,
                            (
                                site_key, device_key, timestamp, pm2_5, pm10, no2, device_id, device_name,
                                frequency, is_reading_primary, aqi_category, aqi_color, aqi_color_name, time_difference_hours
                            )
                        )

                        reading_key = cursor.fetchone()[0]
                        inserted_count += 1

                        health_tips = measurement.get('health_tips', [])
                        for tip in health_tips:
                            try:
                                tip_id = tip.get('_id')
                                title = tip.get('title')
                                description = tip.get('description')
                                image = tip.get('image')
                                tag_line = tip.get('tag_line')

                                cursor.execute(
                                    """
                                    SELECT 1 FROM fact_health_tips
                                    WHERE reading_key = %s AND tip_id = %s
                                    LIMIT 1
                                    """,
                                    (reading_key, tip_id)
                                )

                                if not cursor.fetchone():
                                    cursor.execute(
                                        """
                                        INSERT INTO fact_health_tips
                                        (reading_key, tip_id, title, description, image_url, tag_line)
                                        VALUES (%s, %s, %s, %s, %s, %s)
                                        """,
                                        (reading_key, tip_id, title, description, image, tag_line)
                                    )
                            except Exception as tip_error:
                                logger.error(f"Error processing health tip {tip_id} for reading {reading_key}: {str(tip_error)}")
                                continue
                    except Exception as m_error:
                        logger.error(f"Error processing measurement for site {site_id}: {str(m_error)}")
                        continue
            finally:
                cursor.close()

        connection.commit()
        logger.info(f"Measurements processing complete. Inserted: {inserted_count}, Skipped: {skipped_count}")

    except Exception as e:
        connection.rollback()
        logger.error(f"Error in store_site_measurements: {str(e)}")
        raise

    finally:
        connection.close()


with DAG(
    'airqo_site_measurements_collector',
    default_args=default_args,
    description='Collect recent measurements from AirQo API for all sites',
    schedule_interval=timedelta(hours=1),
    start_date=datetime(2025, 4, 1),
    catchup=False,
    tags=['airqo', 'measurements', 'sites', 'api'],
) as dag:

    setup_tables = PostgresOperator(
        task_id='setup_tables',
        postgres_conn_id='postgres_default',
        sql="""
        CREATE TABLE IF NOT EXISTS fact_site_readings (
            reading_key SERIAL PRIMARY KEY,
            site_key INTEGER REFERENCES dim_site(site_key),
            device_key INTEGER REFERENCES dim_device(device_key),
            timestamp TIMESTAMP NOT NULL,
            device_id VARCHAR(100),
            device_name VARCHAR(100),
            pm2_5 DECIMAL(10, 5),
            pm10 DECIMAL(10, 5),
            no2 DECIMAL(10, 5),
            frequency VARCHAR(20),
            is_reading_primary BOOLEAN DEFAULT FALSE,
            aqi_category VARCHAR(50),
            aqi_color VARCHAR(20),
            aqi_color_name VARCHAR(50),
            time_difference_hours DECIMAL(10, 5),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(site_key, timestamp)
        );

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'fact_health_tips' 
                AND column_name = 'tag_line'
            ) THEN
                ALTER TABLE fact_health_tips ADD COLUMN tag_line TEXT;
            END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_fact_site_readings_site_timestamp 
        ON fact_site_readings(site_key, timestamp);

        CREATE INDEX IF NOT EXISTS idx_fact_site_readings_timestamp 
        ON fact_site_readings(timestamp);

        CREATE INDEX IF NOT EXISTS idx_fact_site_readings_device 
        ON fact_site_readings(device_key);
        """
    )

    get_site_ids_task = PythonOperator(
        task_id='get_site_ids',
        python_callable=get_site_ids,
    )

    process_sites_task = PythonOperator(
        task_id='process_all_sites',
        python_callable=process_all_sites,
    )

    store_measurements_task = PythonOperator(
        task_id='store_site_measurements',
        python_callable=store_site_measurements,
    )

    setup_tables >> get_site_ids_task >> process_sites_task >> store_measurements_task