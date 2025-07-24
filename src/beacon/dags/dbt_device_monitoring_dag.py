# dags/device_status_monitoring_dag.py
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.sensors.external_task import ExternalTaskSensor
from airflow.utils.task_group import TaskGroup
import pandas as pd

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=3),
}

# This function identifies devices that didn't send data despite being active
def identify_missing_data_devices(**kwargs):
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    
    # Set time window for analysis (e.g., last 24 hours)
    end_time = datetime.now()
    start_time = end_time - timedelta(hours=24)
    
    # SQL query to identify active & deployed devices with no recent data
    query = """
    WITH active_deployed_devices AS (
        SELECT 
            d.device_key, 
            d.device_id, 
            d.device_name, 
            d.status,
            d.is_active,
            d.is_online
        FROM 
            dim_device d
        WHERE 
            d.is_active = true 
            AND d.status = 'deployed'
    ),
    devices_with_recent_data AS (
        SELECT 
            DISTINCT r.device_key
        FROM 
            fact_device_readings r
        WHERE 
            r.timestamp BETWEEN %s AND %s
    )
    SELECT 
        d.*
    FROM 
        active_deployed_devices d
    LEFT JOIN 
        devices_with_recent_data r ON d.device_key = r.device_key
    WHERE 
        r.device_key IS NULL;
    """
    
    connection = pg_hook.get_conn()
    
    try:
        # Execute query
        df = pd.read_sql(query, connection, params=[start_time, end_time])
        
        if df.empty:
            print("All active and deployed devices are sending data correctly.")
            return []
            
        print(f"Found {len(df)} active and deployed devices not sending data:")
        print(df[['device_id', 'device_name', 'status', 'is_online']].head())
        
        # Update status in fact_device_status
        cursor = connection.cursor()
        
        # Log each device with missing data
        for _, row in df.iterrows():
            device_key = row['device_key']
            device_id = row['device_id']
            
            # Insert new status record noting the missing data
            cursor.execute(
                """
                INSERT INTO fact_device_status 
                (device_key, timestamp, is_online, device_status, issue_detected, issue_type, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    device_key,
                    datetime.now(),
                    False,  # Assume device is offline if not sending data
                    'deployed',
                    True,
                    'missing_data',
                    'Active and deployed device not sending data'
                )
            )
            
            print(f"Recorded missing data issue for device {device_id}")
            
        connection.commit()
        cursor.close()
        
        # Return list of device keys with issues
        return df['device_key'].tolist()
        
    except Exception as e:
        print(f"Error in identify_missing_data_devices: {str(e)}")
        raise
    finally:
        connection.close()

# This function detects changes in device status (online to offline or vice versa)
def detect_status_changes(**kwargs):
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    
    # SQL query to detect status changes
    query = """
    WITH current_status AS (
        SELECT 
            d.device_key,
            d.device_id,
            d.device_name,
            d.is_online as current_online_status
        FROM 
            dim_device d
        WHERE 
            d.status = 'deployed'
    ),
    previous_status AS (
        SELECT 
            DISTINCT ON (device_key) 
            device_key,
            is_online as previous_online_status
        FROM 
            fact_device_status
        WHERE 
            timestamp < NOW() - INTERVAL '1 hour'
        ORDER BY 
            device_key, timestamp DESC
    )
    SELECT 
        c.device_key,
        c.device_id,
        c.device_name,
        c.current_online_status,
        p.previous_online_status
    FROM 
        current_status c
    JOIN 
        previous_status p ON c.device_key = p.device_key
    WHERE 
        c.current_online_status != p.previous_online_status;
    """
    
    connection = pg_hook.get_conn()
    
    try:
        # Execute query
        df = pd.read_sql(query, connection)
        
        if df.empty:
            print("No status changes detected.")
            return []
            
        print(f"Found {len(df)} devices with status changes:")
        print(df[['device_id', 'device_name', 'current_online_status', 'previous_online_status']].head())
        
        # Update status changes in fact_device_status
        cursor = connection.cursor()
        
        # Process each device with status change
        for _, row in df.iterrows():
            device_key = row['device_key']
            device_id = row['device_id']
            current_status = row['current_online_status']
            previous_status = row['previous_online_status']
            
            status_change_type = 'went_offline' if not current_status else 'came_online'
            note = f"Device {'went offline' if not current_status else 'came online'} (previous status: {'online' if previous_status else 'offline'})"
            
            # Insert status change record
            cursor.execute(
                """
                INSERT INTO fact_device_status 
                (device_key, timestamp, is_online, device_status, issue_detected, issue_type, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    device_key,
                    datetime.now(),
                    current_status,
                    'deployed',
                    current_status is False,  # Issue detected only if device went offline
                    status_change_type,
                    note
                )
            )
            
            print(f"Recorded status change for device {device_id}: {note}")
            
        connection.commit()
        cursor.close()
        
        # Return list of device keys with status changes
        return df['device_key'].tolist()
        
    except Exception as e:
        print(f"Error in detect_status_changes: {str(e)}")
        raise
    finally:
        connection.close()

# Function to identify inactive but deployed devices
def identify_inactive_deployed_devices(**kwargs):
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    
    query = """
    SELECT 
        device_key,
        device_id,
        device_name,
        status,
        is_active,
        is_online
    FROM 
        dim_device
    WHERE 
        status = 'deployed'
        AND is_active = false;
    """
    
    connection = pg_hook.get_conn()
    
    try:
        # Execute query
        df = pd.read_sql(query, connection)
        
        if df.empty:
            print("No inactive but deployed devices found.")
            return []
            
        print(f"Found {len(df)} inactive but deployed devices:")
        print(df[['device_id', 'device_name', 'status', 'is_online']].head())
        
        # Update inactive deployed devices in fact_device_status
        cursor = connection.cursor()
        
        for _, row in df.iterrows():
            device_key = row['device_key']
            device_id = row['device_id']
            
            # Insert status record
            cursor.execute(
                """
                INSERT INTO fact_device_status 
                (device_key, timestamp, is_online, device_status, issue_detected, issue_type, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    device_key,
                    datetime.now(),
                    False,
                    'deployed',
                    True,
                    'inactive_deployed',
                    'Device is marked as deployed but inactive'
                )
            )
            
            print(f"Recorded inactive but deployed status for device {device_id}")
            
        connection.commit()
        cursor.close()
        
        # Return list of inactive deployed device keys
        return df['device_key'].tolist()
        
    except Exception as e:
        print(f"Error in identify_inactive_deployed_devices: {str(e)}")
        raise
    finally:
        connection.close()

# Function to update device metrics
def update_device_metrics(**kwargs):
    ti = kwargs['ti']
    
    # Pull device lists from previous tasks
    missing_data_devices = ti.xcom_pull(task_ids='identify_missing_data_devices') or []
    status_change_devices = ti.xcom_pull(task_ids='detect_status_changes') or []
    inactive_deployed_devices = ti.xcom_pull(task_ids='identify_inactive_deployed_devices') or []
    
    # Combine all device lists (remove duplicates)
    all_affected_devices = list(set(missing_data_devices + status_change_devices + inactive_deployed_devices))
    
    if not all_affected_devices:
        print("No device issues to update.")
        return
    
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    connection = pg_hook.get_conn()
    
    try:
        cursor = connection.cursor()
        
        # For each affected device, calculate updated metrics
        for device_key in all_affected_devices:
            # Calculate device uptime percentage (last 30 days)
            cursor.execute(
                """
                WITH status_history AS (
                    SELECT 
                        timestamp,
                        is_online,
                        LEAD(timestamp) OVER (ORDER BY timestamp) AS next_timestamp
                    FROM 
                        fact_device_status
                    WHERE 
                        device_key = %s
                        AND timestamp >= NOW() - INTERVAL '30 days'
                    ORDER BY 
                        timestamp
                ),
                time_calculations AS (
                    SELECT
                        SUM(
                            CASE 
                                WHEN is_online = true AND next_timestamp IS NOT NULL 
                                THEN EXTRACT(EPOCH FROM (next_timestamp - timestamp)) 
                                WHEN is_online = true AND next_timestamp IS NULL 
                                THEN EXTRACT(EPOCH FROM (NOW() - timestamp))
                                ELSE 0 
                            END
                        ) AS online_seconds,
                        EXTRACT(EPOCH FROM (NOW() - (NOW() - INTERVAL '30 days'))) AS total_period_seconds
                    FROM 
                        status_history
                )
                SELECT 
                    CASE 
                        WHEN total_period_seconds > 0 
                        THEN (online_seconds / total_period_seconds) * 100
                        ELSE 0
                    END AS uptime_percentage
                FROM 
                    time_calculations;
                """,
                (device_key,)
            )
            
            result = cursor.fetchone()
            uptime_percentage = result[0] if result else 0
            
            # Calculate MTBF (Mean Time Between Failures) - in hours
            cursor.execute(
                """
                WITH status_changes AS (
                    SELECT 
                        timestamp,
                        is_online,
                        LAG(is_online) OVER (ORDER BY timestamp) AS prev_status,
                        LAG(timestamp) OVER (ORDER BY timestamp) AS prev_timestamp
                    FROM 
                        fact_device_status
                    WHERE 
                        device_key = %s
                        AND timestamp >= NOW() - INTERVAL '90 days'
                    ORDER BY 
                        timestamp
                ),
                failures AS (
                    SELECT 
                        timestamp AS failure_time,
                        prev_timestamp AS prev_failure_time
                    FROM 
                        status_changes
                    WHERE 
                        is_online = false 
                        AND prev_status = true
                )
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (failure_time - prev_failure_time)) / 3600) AS mtbf_hours
                FROM 
                    failures
                WHERE 
                    prev_failure_time IS NOT NULL;
                """,
                (device_key,)
            )
            
            result = cursor.fetchone()
            mtbf_hours = result[0] if result and result[0] is not None else None
            
            # Calculate MTTR (Mean Time To Recovery) - in hours
            cursor.execute(
                """
                WITH status_changes AS (
                    SELECT 
                        timestamp,
                        is_online,
                        LAG(is_online) OVER (ORDER BY timestamp) AS prev_status,
                        LAG(timestamp) OVER (ORDER BY timestamp) AS prev_timestamp
                    FROM 
                        fact_device_status
                    WHERE 
                        device_key = %s
                        AND timestamp >= NOW() - INTERVAL '90 days'
                    ORDER BY 
                        timestamp
                ),
                recoveries AS (
                    SELECT 
                        timestamp AS recovery_time,
                        prev_timestamp AS failure_time
                    FROM 
                        status_changes
                    WHERE 
                        is_online = true 
                        AND prev_status = false
                )
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (recovery_time - failure_time)) / 3600) AS mttr_hours
                FROM 
                    recoveries
                WHERE 
                    failure_time IS NOT NULL;
                """,
                (device_key,)
            )
            
            result = cursor.fetchone()
            mttr_hours = result[0] if result and result[0] is not None else None
            
            # Update device metrics
            cursor.execute(
                """
                INSERT INTO fact_device_metrics
                (device_key, timestamp, uptime_percentage, mtbf_hours, mttr_hours)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    device_key,
                    datetime.now(),
                    uptime_percentage,
                    mtbf_hours,
                    mttr_hours
                )
            )
            
            print(f"Updated metrics for device {device_key}: Uptime={uptime_percentage:.2f}%, MTBF={mtbf_hours or 'N/A'}, MTTR={mttr_hours or 'N/A'}")
            
        connection.commit()
        cursor.close()
        
    except Exception as e:
        print(f"Error in update_device_metrics: {str(e)}")
        raise
    finally:
        connection.close()

# Create the DAG
with DAG(
    'device_status_monitoring',
    default_args=default_args,
    description='Monitor device status changes and identify devices not sending data',
    schedule_interval=timedelta(hours=1),
    start_date=datetime(2025, 4, 1),
    catchup=False,
    tags=['airqo', 'device-monitoring', 'status-changes'],
) as dag:
    
    # Create necessary tables for device status monitoring
    setup_tables = PostgresOperator(
        task_id='setup_monitoring_tables',
        postgres_conn_id='postgres_default',
        sql="""
        -- Modify fact_device_status to include additional monitoring fields
        CREATE TABLE IF NOT EXISTS fact_device_status (
            status_key SERIAL PRIMARY KEY,
            device_key INTEGER REFERENCES dim_device(device_key),
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            is_online BOOLEAN,
            device_status VARCHAR(50),
            battery_voltage DECIMAL(5, 2),
            signal_strength_dbm INTEGER,
            temperature_celsius DECIMAL(5, 2),
            humidity_percent DECIMAL(5, 2),
            issue_detected BOOLEAN DEFAULT FALSE,
            issue_type VARCHAR(50),
            notes TEXT
        );
        
        -- Create table for device metrics
        CREATE TABLE IF NOT EXISTS fact_device_metrics (
            metric_key SERIAL PRIMARY KEY,
            device_key INTEGER REFERENCES dim_device(device_key),
            timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
            uptime_percentage DECIMAL(5, 2),
            mtbf_hours DECIMAL(10, 2),  -- Mean Time Between Failures
            mttr_hours DECIMAL(10, 2),  -- Mean Time To Recovery
            reliability_score DECIMAL(5, 2),
            data_quality_score DECIMAL(5, 2)
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_fact_device_status_device_timestamp 
        ON fact_device_status(device_key, timestamp);
        
        CREATE INDEX IF NOT EXISTS idx_fact_device_status_issue 
        ON fact_device_status(issue_detected, issue_type);
        
        CREATE INDEX IF NOT EXISTS idx_fact_device_metrics_device_timestamp 
        ON fact_device_metrics(device_key, timestamp);
        """
    )
    
    # Task to identify devices with missing data
    missing_data_task = PythonOperator(
        task_id='identify_missing_data_devices',
        python_callable=identify_missing_data_devices,
    )
    
    # Task to detect status changes
    status_changes_task = PythonOperator(
        task_id='detect_status_changes',
        python_callable=detect_status_changes,
    )
    
    # Task to identify inactive but deployed devices
    inactive_deployed_task = PythonOperator(
        task_id='identify_inactive_deployed_devices',
        python_callable=identify_inactive_deployed_devices,
    )
    
    # Task to update device metrics
    update_metrics_task = PythonOperator(
        task_id='update_device_metrics',
        python_callable=update_device_metrics,
    )
   
    setup_tables >> [missing_data_task, status_changes_task, inactive_deployed_task]
    [missing_data_task, status_changes_task, inactive_deployed_task] >> update_metrics_task