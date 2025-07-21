# dags/maintenance_scheduling_dag.py
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.models import Variable
import pandas as pd
import numpy as np

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def get_maintenance_candidates(**kwargs):
    """
    Determine devices that need maintenance based on:
    1. Low battery health
    2. Poor signal quality
    3. Inaccurate readings (from co-location tests)
    4. Time since last maintenance
    """
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    conn = pg_hook.get_conn()
    
    # Get devices needing maintenance
    query = """
    WITH device_stats AS (
        SELECT 
            d.device_key,
            d.device_id,
            d.device_name,
            h.battery_voltage,
            h.signal_strength_dbm,
            h.overall_status,
            l.latitude,
            l.longitude,
            l.region,
            COALESCE(MAX(m.id), 0) as last_maintenance_id,
            COALESCE(MAX(m.date_key), 0) as last_maintenance_date
        FROM dim_device d
        JOIN device_health_status h ON d.device_key = h.device_key
        LEFT JOIN fact_maintenance m ON d.device_key = m.device_key
        LEFT JOIN dim_location l ON d.device_key = l.location_key
        WHERE d.is_currently_active = true
        GROUP BY d.device_key, d.device_id, d.device_name, h.battery_voltage, 
                 h.signal_strength_dbm, h.overall_status, l.latitude, l.longitude, l.region
    )
    SELECT 
        device_key,
        device_id,
        device_name,
        battery_voltage,
        signal_strength_dbm,
        overall_status,
        latitude,
        longitude,
        region,
        CASE
            WHEN overall_status = 'Critical' THEN 1
            WHEN overall_status = 'Warning' AND last_maintenance_date < EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days')/86400 THEN 2
            WHEN overall_status = 'Healthy' AND last_maintenance_date < EXTRACT(EPOCH FROM NOW() - INTERVAL '180 days')/86400 THEN 3
            ELSE 4
        END as priority
    FROM device_stats
    WHERE overall_status IN ('Critical', 'Warning') 
       OR last_maintenance_date < EXTRACT(EPOCH FROM NOW() - INTERVAL '180 days')/86400
    ORDER BY priority, last_maintenance_date
    """
    
    candidates_df = pd.read_sql(query, conn)
    return candidates_df.to_dict('records')

def generate_maintenance_schedule(**kwargs):
    """Generate optimized maintenance schedule based on location and priority"""
    ti = kwargs['ti']
    candidates = ti.xcom_pull(task_ids='get_maintenance_candidates')
    
    # Maximum number of devices to schedule
    max_devices = 10
    
    if not candidates or len(candidates) == 0:
        print("No devices need maintenance at this time")
        return []
    
    # Group devices by region for more efficient field visits
    by_region = {}
    for device in candidates:
        region = device['region'] if device['region'] else 'Unknown'
        if region not in by_region:
            by_region[region] = []
        by_region[region].append(device)
    
    # Create schedule prioritizing critical devices and grouping by region
    schedule = []
    remaining = max_devices
    
    # First, schedule all priority 1 (Critical) devices
    for region, devices in by_region.items():
        critical_devices = [d for d in devices if d['priority'] == 1]
        for device in critical_devices[:remaining]:
            schedule.append({
                'device_id': device['device_id'],
                'device_name': device['device_name'],
                'region': region,
                'priority': device['priority'],
                'maintenance_date': (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d'),
                'maintenance_type': 'Corrective'
            })
        remaining -= len(critical_devices[:remaining])
        if remaining <= 0:
            break
    
    # Next, schedule priority 2 and 3
    if remaining > 0:
        for region, devices in by_region.items():
            lower_priority = [d for d in devices if d['priority'] in (2, 3) and d not in schedule]
            for device in lower_priority[:remaining]:
                schedule.append({
                    'device_id': device['device_id'],
                    'device_name': device['device_name'],
                    'region': region,
                    'priority': device['priority'],
                    'maintenance_date': (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
                    'maintenance_type': 'Preventive'
                })
            remaining -= len(lower_priority[:remaining])
            if remaining <= 0:
                break
    
    # Insert schedule into database
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    conn = pg_hook.get_conn()
    cursor = conn.cursor()
    
    for item in schedule:
        cursor.execute(
            """
            INSERT INTO maintenance_schedule
            (device_id, scheduled_date, maintenance_type, priority, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            """,
            (
                item['device_id'],
                item['maintenance_date'],
                item['maintenance_type'],
                item['priority']
            )
        )
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return schedule

with DAG(
    'maintenance_scheduling',
    default_args=default_args,
    description='Schedule device maintenance based on performance metrics',
    schedule_interval='0 0 * * 1',  # Weekly on Monday
    start_date=datetime(2025, 3, 1),
    catchup=False,
    tags=['airqo', 'maintenance', 'scheduling'],
) as dag:
    
    get_candidates = PythonOperator(
        task_id='get_maintenance_candidates',
        python_callable=get_maintenance_candidates,
    )
    
    create_schedule = PythonOperator(
        task_id='generate_maintenance_schedule',
        python_callable=generate_maintenance_schedule,
    )
    
    get_candidates >> create_schedule