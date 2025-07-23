from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.providers.postgres.hooks.postgres import PostgresHook
import pandas as pd
import numpy as np
import statistics
from sqlalchemy import create_engine, text

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# Helper functions for calculating performance metrics
def calculate_uptime(df):
    """Calculate uptime based on consecutive readings"""
    if df.empty:
        return 0.0
    
    # Sort by timestamp
    df = df.sort_values('timestamp')
    
    # Calculate time differences between consecutive readings in hours
    df['time_diff'] = df['timestamp'].diff().dt.total_seconds() / 3600
    
    # Consider gaps less than 2 hours as normal operation
    active_hours = sum(min(2, t) if not pd.isna(t) and t <= 2 else 0 for t in df['time_diff'])
    
    # Add one hour for the first reading
    active_hours += 1
    
    # Total hours in the period
    period_hours = 24.0
    
    # Calculate uptime percentage (capped at 100%)
    uptime = min(100, (active_hours / period_hours) * 100)
    
    return uptime

def upsert_device_metrics(results_df, engine):
    """
    Insert or update device metrics using PostgreSQL's ON CONFLICT
    """
    if results_df.empty:
        return 0
    
    # Convert DataFrame to list of dictionaries
    records = results_df.to_dict('records')
    
    # Build the upsert query
    upsert_query = text("""
    INSERT INTO device_daily_metrics (
        device_key, device_id, date, uptime, data_completeness, 
        readings_count, expected_readings, avg_battery_voltage, 
        min_battery_voltage, avg_signal_strength, min_signal_strength, 
        pm25_avg, pm10_avg, pm25_std, pm10_std, calculated_at
    ) 
    VALUES (
        :device_key, :device_id, :date, :uptime, :data_completeness,
        :readings_count, :expected_readings, :avg_battery_voltage,
        :min_battery_voltage, :avg_signal_strength, :min_signal_strength,
        :pm25_avg, :pm10_avg, :pm25_std, :pm10_std, :calculated_at
    )
    ON CONFLICT (device_key, date) 
    DO UPDATE SET
        device_id = EXCLUDED.device_id,
        uptime = EXCLUDED.uptime,
        data_completeness = EXCLUDED.data_completeness,
        readings_count = EXCLUDED.readings_count,
        expected_readings = EXCLUDED.expected_readings,
        avg_battery_voltage = EXCLUDED.avg_battery_voltage,
        min_battery_voltage = EXCLUDED.min_battery_voltage,
        avg_signal_strength = EXCLUDED.avg_signal_strength,
        min_signal_strength = EXCLUDED.min_signal_strength,
        pm25_avg = EXCLUDED.pm25_avg,
        pm10_avg = EXCLUDED.pm10_avg,
        pm25_std = EXCLUDED.pm25_std,
        pm10_std = EXCLUDED.pm10_std,
        calculated_at = EXCLUDED.calculated_at
    """)
    
    # Execute the upsert for each record
    with engine.connect() as conn:
        with conn.begin():
            for record in records:
                conn.execute(upsert_query, record)
    
    return len(records)

def calculate_device_daily_metrics():
    """
    Calculate daily performance metrics for each device
    """
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    conn = pg_hook.get_conn()
    
    # Get the last 7 days of data
    days_to_analyze = 7
    
    # Query to get device readings for the last N days
    query = f"""
    SELECT 
        d.device_key, 
        d.device_id,
        r.timestamp, 
        r.pm2_5, 
        r.pm10, 
        r.battery_voltage, 
        r.signal_strength_dbm,
        r.humidity_percent,
        r.temperature_celsius
    FROM 
        dim_device d
    JOIN 
        fact_device_readings r ON d.device_key = r.device_key
    WHERE 
        r.timestamp >= NOW() - INTERVAL '{days_to_analyze} days'
    ORDER BY 
        d.device_key, r.timestamp
    """
    
    df = pd.read_sql(query, conn)
    
    # Create a database engine for saving results
    engine = create_engine(pg_hook.get_uri())
    
    # Process the data by device_id and day
    results = []
    
    # Group by device_id and date
    df['date'] = df['timestamp'].dt.date
    grouped = df.groupby(['device_id', 'date'])
    
    for (device_id, date), group in grouped:
        # Count readings
        readings_count = len(group)
        expected_readings = 24  # Expected hourly readings
        
        # Calculate data completeness
        data_completeness = min(100, (readings_count / expected_readings) * 100)
        
        # Calculate uptime
        uptime = calculate_uptime(group)
        
        # Calculate battery and signal metrics if available
        battery_readings = group['battery_voltage'].dropna()
        signal_readings = group['signal_strength_dbm'].dropna()
        
        avg_battery = float(battery_readings.mean()) if len(battery_readings) > 0 else None
        avg_signal = float(signal_readings.mean()) if len(signal_readings) > 0 else None
        min_battery = float(battery_readings.min()) if len(battery_readings) > 0 else None
        min_signal = float(signal_readings.min()) if len(signal_readings) > 0 else None
        
        # Calculate PM2.5 and PM10 readings quality
        pm25_readings = group['pm2_5'].dropna()
        pm10_readings = group['pm10'].dropna()
        
        pm25_avg = float(pm25_readings.mean()) if len(pm25_readings) > 0 else None
        pm10_avg = float(pm10_readings.mean()) if len(pm10_readings) > 0 else None
        pm25_std = float(pm25_readings.std()) if len(pm25_readings) > 1 else None
        pm10_std = float(pm10_readings.std()) if len(pm10_readings) > 1 else None
        
        # Get device_key from the group
        device_key = group['device_key'].iloc[0]
        
        # Append to results
        results.append({
            'device_key': device_key,
            'device_id': device_id,
            'date': date,
            'uptime': uptime,
            'data_completeness': data_completeness,
            'readings_count': readings_count,
            'expected_readings': expected_readings,
            'avg_battery_voltage': avg_battery,
            'min_battery_voltage': min_battery,
            'avg_signal_strength': avg_signal,
            'min_signal_strength': min_signal,
            'pm25_avg': pm25_avg,
            'pm10_avg': pm10_avg,
            'pm25_std': pm25_std,
            'pm10_std': pm10_std,
            'calculated_at': datetime.now()
        })
    
    # Create DataFrame from results
    results_df = pd.DataFrame(results)
    
    # Save to database using upsert to handle duplicates
    if not results_df.empty:
        records_saved = upsert_device_metrics(results_df, engine)
        print(f"Upserted {records_saved} daily metric records to the database")
    else:
        print("No daily metrics calculated - dataset is empty")
        records_saved = 0
    
    return records_saved

def upsert_health_scores(results_df, engine):
    """
    Insert or update device health scores using PostgreSQL's ON CONFLICT
    """
    if results_df.empty:
        return 0
    
    # Convert DataFrame to list of dictionaries
    records = results_df.to_dict('records')
    
    # Build the upsert query - using device_key and date from calculated_at for uniqueness
    upsert_query = text("""
    INSERT INTO device_health_scores (
        device_key, device_id, health_score, uptime_score, data_completeness_score,
        battery_health_score, signal_quality_score, failure_days_count,
        days_analyzed, uptime_stability, calculated_at
    ) 
    VALUES (
        :device_key, :device_id, :health_score, :uptime_score, :data_completeness_score,
        :battery_health_score, :signal_quality_score, :failure_days_count,
        :days_analyzed, :uptime_stability, :calculated_at
    )
    ON CONFLICT (device_key, calculated_at) 
    DO UPDATE SET
        device_id = EXCLUDED.device_id,
        health_score = EXCLUDED.health_score,
        uptime_score = EXCLUDED.uptime_score,
        data_completeness_score = EXCLUDED.data_completeness_score,
        battery_health_score = EXCLUDED.battery_health_score,
        signal_quality_score = EXCLUDED.signal_quality_score,
        failure_days_count = EXCLUDED.failure_days_count,
        days_analyzed = EXCLUDED.days_analyzed,
        uptime_stability = EXCLUDED.uptime_stability
    """)
    
    # Execute the upsert for each record
    with engine.connect() as conn:
        with conn.begin():
            for record in records:
                conn.execute(upsert_query, record)
    
    return len(records)

def calculate_device_health_scores():
    """
    Calculate overall health scores for each device based on daily metrics
    """
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    conn = pg_hook.get_conn()
    
    # Query to get daily metrics for the last 30 days
    query = """
    SELECT 
        device_key,
        device_id,
        date,
        uptime,
        data_completeness,
        readings_count,
        avg_battery_voltage,
        avg_signal_strength
    FROM 
        device_daily_metrics
    WHERE 
        date >= NOW() - INTERVAL '30 days'
    ORDER BY 
        device_key, date
    """
    
    df = pd.read_sql(query, conn)
    
    if df.empty:
        print("No daily metrics found for health score calculation")
        return 0
    
    # Create a database engine for saving results
    engine = create_engine(pg_hook.get_uri())
    
    # Group by device_id
    device_health = []
    
    for device_id, group in df.groupby('device_id'):
        # Get device_key
        device_key = group['device_key'].iloc[0]
        
        # Calculate uptime score (30% weight)
        avg_uptime = group['uptime'].mean()
        uptime_score = min(100, avg_uptime)
        
        # Calculate data completeness score (30% weight)
        avg_completeness = group['data_completeness'].mean()
        completeness_score = min(100, avg_completeness)
        
        # Calculate battery health (20% weight)
        battery_values = group['avg_battery_voltage'].dropna()
        
        if len(battery_values) > 0:
            # Normalize battery voltage to percentage (assuming 3.0V min, 4.2V max for typical LiPo)
            battery_levels = [min(100, max(0, ((v - 3.0) / 1.2) * 100)) for v in battery_values]
            
            # Use mean and stability for health score
            if len(battery_levels) > 1:
                battery_mean = np.mean(battery_levels)
                battery_std = np.std(battery_levels)
                
                # Lower variability is better for battery (up to a point)
                battery_stability = max(0, 100 - (battery_std * 5))
                battery_score = (battery_mean * 0.7) + (battery_stability * 0.3)
            else:
                battery_score = battery_levels[0]
        else:
            battery_score = None
        
        # Calculate signal strength (20% weight)
        signal_values = group['avg_signal_strength'].dropna()
        
        if len(signal_values) > 0:
            # Normalize signal strength (-110dBm to -50dBm typical range)
            signal_levels = [min(100, max(0, ((v + 110) / 60) * 100)) for v in signal_values]
            signal_score = np.mean(signal_levels)
        else:
            signal_score = None
        
        # Calculate overall health score with available metrics
        weights = {
            'uptime': 0.3,
            'completeness': 0.3,
            'battery': 0.2,
            'signal': 0.2
        }
        
        # Adjust weights if some metrics are missing
        if battery_score is None and signal_score is None:
            weights['uptime'] = 0.5
            weights['completeness'] = 0.5
            overall_score = (uptime_score * weights['uptime']) + (completeness_score * weights['completeness'])
        elif battery_score is None:
            weights['uptime'] = 0.4
            weights['completeness'] = 0.4
            weights['signal'] = 0.2
            overall_score = (uptime_score * weights['uptime']) + (completeness_score * weights['completeness']) + (signal_score * weights['signal'])
        elif signal_score is None:
            weights['uptime'] = 0.4
            weights['completeness'] = 0.4
            weights['battery'] = 0.2
            overall_score = (uptime_score * weights['uptime']) + (completeness_score * weights['completeness']) + (battery_score * weights['battery'])
        else:
            overall_score = (uptime_score * weights['uptime']) + (completeness_score * weights['completeness']) + (battery_score * weights['battery']) + (signal_score * weights['signal'])
        
        # Count days with < 50% uptime (indicates possible failures)
        failure_days = len(group[group['uptime'] < 50])
        
        # Calculate day-to-day stability (lower variance is better)
        uptime_variance = group['uptime'].var() if len(group) > 1 else 0
        
        device_health.append({
            'device_key': device_key,
            'device_id': device_id,
            'health_score': round(overall_score, 2),
            'uptime_score': round(uptime_score, 2),
            'data_completeness_score': round(completeness_score, 2),
            'battery_health_score': round(battery_score, 2) if battery_score is not None else None,
            'signal_quality_score': round(signal_score, 2) if signal_score is not None else None,
            'failure_days_count': failure_days,
            'days_analyzed': len(group),
            'uptime_stability': round(100 - min(100, uptime_variance / 5), 2),
            'calculated_at': datetime.now()
        })
    
    # Create DataFrame from results
    results_df = pd.DataFrame(device_health)
    
    # Save to database using upsert
    if not results_df.empty:
        records_saved = upsert_health_scores(results_df, engine)
        print(f"Upserted {records_saved} device health scores to the database")
    else:
        print("No health scores calculated - dataset is empty")
        records_saved = 0
    
    return records_saved

def upsert_maintenance_effectiveness(results_df, engine):
    """
    Insert or update maintenance effectiveness using PostgreSQL's ON CONFLICT
    """
    if results_df.empty:
        return 0
    
    # Convert DataFrame to list of dictionaries
    records = results_df.to_dict('records')
    
    # Build the upsert query
    upsert_query = text("""
    INSERT INTO maintenance_effectiveness (
        device_key, device_id, maintenance_date, uptime_before, uptime_after,
        uptime_improvement, data_completeness_before, data_completeness_after,
        data_completeness_improvement, days_before, days_after,
        effectiveness_score, outcome, calculated_at
    ) 
    VALUES (
        :device_key, :device_id, :maintenance_date, :uptime_before, :uptime_after,
        :uptime_improvement, :data_completeness_before, :data_completeness_after,
        :data_completeness_improvement, :days_before, :days_after,
        :effectiveness_score, :outcome, :calculated_at
    )
    ON CONFLICT (device_key, maintenance_date) 
    DO UPDATE SET
        device_id = EXCLUDED.device_id,
        uptime_before = EXCLUDED.uptime_before,
        uptime_after = EXCLUDED.uptime_after,
        uptime_improvement = EXCLUDED.uptime_improvement,
        data_completeness_before = EXCLUDED.data_completeness_before,
        data_completeness_after = EXCLUDED.data_completeness_after,
        data_completeness_improvement = EXCLUDED.data_completeness_improvement,
        days_before = EXCLUDED.days_before,
        days_after = EXCLUDED.days_after,
        effectiveness_score = EXCLUDED.effectiveness_score,
        outcome = EXCLUDED.outcome,
        calculated_at = EXCLUDED.calculated_at
    """)
    
    # Execute the upsert for each record
    with engine.connect() as conn:
        with conn.begin():
            for record in records:
                conn.execute(upsert_query, record)
    
    return len(records)

def analyze_maintenance_effectiveness():
    """
    Calculate the effectiveness of maintenance activities
    """
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    conn = pg_hook.get_conn()
    
    # Query to get maintenance events and performance before/after
    query = """
    WITH status_changes AS (
        SELECT 
            device_key,
            timestamp,
            is_online,
            device_status,
            LAG(is_online) OVER (PARTITION BY device_key ORDER BY timestamp) as prev_is_online,
            LAG(device_status) OVER (PARTITION BY device_key ORDER BY timestamp) as prev_device_status
        FROM 
            fact_device_status
    ),
    
    maintenance_events AS (
        SELECT 
            sc.device_key,
            sc.timestamp AS maintenance_date,
            d.device_id
        FROM 
            status_changes sc
        JOIN 
            dim_device d ON sc.device_key = d.device_key
        WHERE 
            sc.device_status = 'maintenance'
            OR (sc.prev_is_online = false AND sc.is_online = true)
        ORDER BY 
            sc.device_key, sc.timestamp
    ),
    
    metrics_before AS (
        SELECT 
            m.device_key,
            e.maintenance_date,
            AVG(m.uptime) AS avg_uptime_before,
            AVG(m.data_completeness) AS avg_completeness_before,
            COUNT(*) AS days_before
        FROM 
            maintenance_events e
        JOIN 
            device_daily_metrics m ON e.device_key = m.device_key
        WHERE 
            m.date BETWEEN e.maintenance_date - INTERVAL '7 days' AND e.maintenance_date - INTERVAL '1 day'
        GROUP BY 
            m.device_key, e.maintenance_date
    ),
    
    metrics_after AS (
        SELECT 
            m.device_key,
            e.maintenance_date,
            AVG(m.uptime) AS avg_uptime_after,
            AVG(m.data_completeness) AS avg_completeness_after,
            COUNT(*) AS days_after
        FROM 
            maintenance_events e
        JOIN 
            device_daily_metrics m ON e.device_key = m.device_key
        WHERE 
            m.date BETWEEN e.maintenance_date + INTERVAL '1 day' AND e.maintenance_date + INTERVAL '7 days'
        GROUP BY 
            m.device_key, e.maintenance_date
    )
    
    SELECT 
        e.device_key,
        e.device_id,
        e.maintenance_date,
        mb.avg_uptime_before,
        mb.avg_completeness_before,
        mb.days_before,
        ma.avg_uptime_after,
        ma.avg_completeness_after,
        ma.days_after
    FROM 
        maintenance_events e
    LEFT JOIN 
        metrics_before mb ON e.device_key = mb.device_key AND e.maintenance_date = mb.maintenance_date
    LEFT JOIN 
        metrics_after ma ON e.device_key = ma.device_key AND e.maintenance_date = ma.maintenance_date
    WHERE 
        (mb.days_before IS NOT NULL OR ma.days_after IS NOT NULL)
        AND e.maintenance_date >= NOW() - INTERVAL '90 days'
    ORDER BY 
        e.maintenance_date DESC
    """
    
    df = pd.read_sql(query, conn)
    
    if df.empty:
        print("No maintenance events found for analysis")
        return 0
    
    # Create a database engine for saving results
    engine = create_engine(pg_hook.get_uri())
    
    # Calculate effectiveness metrics
    results = []
    
    for _, row in df.iterrows():
        # Calculate improvement metrics
        uptime_before = row['avg_uptime_before'] if not pd.isna(row['avg_uptime_before']) else 0
        uptime_after = row['avg_uptime_after'] if not pd.isna(row['avg_uptime_after']) else 0
        completeness_before = row['avg_completeness_before'] if not pd.isna(row['avg_completeness_before']) else 0
        completeness_after = row['avg_completeness_after'] if not pd.isna(row['avg_completeness_after']) else 0
        
        # Calculate improvement percentages
        uptime_improvement = uptime_after - uptime_before if not pd.isna(uptime_before) and not pd.isna(uptime_after) else None
        completeness_improvement = completeness_after - completeness_before if not pd.isna(completeness_before) and not pd.isna(completeness_after) else None
        
        # Calculate overall effectiveness
        if uptime_improvement is not None and completeness_improvement is not None:
            # Simple average of improvements
            effectiveness = (uptime_improvement + completeness_improvement) / 2
        elif uptime_improvement is not None:
            effectiveness = uptime_improvement
        elif completeness_improvement is not None:
            effectiveness = completeness_improvement
        else:
            effectiveness = None
        
        # Determine success/failure
        if effectiveness is not None:
            if effectiveness > 10:
                outcome = 'Significant Improvement'
            elif effectiveness > 5:
                outcome = 'Moderate Improvement'
            elif effectiveness > 0:
                outcome = 'Slight Improvement'
            elif effectiveness > -5:
                outcome = 'No Significant Change'
            else:
                outcome = 'Degraded Performance'
        else:
            outcome = 'Insufficient Data'
        
        results.append({
            'device_key': row['device_key'],
            'device_id': row['device_id'],
            'maintenance_date': row['maintenance_date'],
            'uptime_before': uptime_before,
            'uptime_after': uptime_after,
            'uptime_improvement': uptime_improvement,
            'data_completeness_before': completeness_before,
            'data_completeness_after': completeness_after,
            'data_completeness_improvement': completeness_improvement,
            'days_before': row['days_before'] if not pd.isna(row['days_before']) else 0,
            'days_after': row['days_after'] if not pd.isna(row['days_after']) else 0,
            'effectiveness_score': effectiveness,
            'outcome': outcome,
            'calculated_at': datetime.now()
        })
    
    # Create DataFrame from results
    results_df = pd.DataFrame(results)
    
    # Save to database using upsert
    if not results_df.empty:
        records_saved = upsert_maintenance_effectiveness(results_df, engine)
        print(f"Upserted {records_saved} maintenance effectiveness records to the database")
    else:
        print("No maintenance effectiveness metrics calculated - dataset is empty")
        records_saved = 0
    
    return records_saved

def calculate_failure_predictions():
    """
    Predict potential device failures based on patterns in performance metrics
    """
    pg_hook = PostgresHook(postgres_conn_id='postgres_default')
    conn = pg_hook.get_conn()
    
    # Query to get daily metrics trend for devices
    query = """
    SELECT 
        device_key,
        device_id,
        date,
        uptime,
        data_completeness,
        avg_battery_voltage,
        avg_signal_strength,
        min_battery_voltage
    FROM 
        device_daily_metrics
    WHERE 
        date >= NOW() - INTERVAL '14 days'
    ORDER BY 
        device_key, date
    """
    
    df = pd.read_sql(query, conn)
    
    if df.empty:
        print("No metrics found for failure prediction")
        return 0
    
    # Create a database engine for saving results
    engine = create_engine(pg_hook.get_uri())
    
    # Group by device_id
    failure_predictions = []
    
    for device_id, group in df.groupby('device_id'):
        # Get device_key
        device_key = group['device_key'].iloc[0]
        
        # Sort by date
        group = group.sort_values('date')
        
        # Calculate performance trends
        uptime_trend = None
        completeness_trend = None
        battery_trend = None
        signal_trend = None
        
        # Need at least 3 days of data for meaningful trend
        if len(group) >= 3:
            # Calculate linear regression slope for each metric
            # A negative slope indicates degradation
            
            # Helper function to calculate slope
            def calculate_slope(y_values):
                if len(y_values.dropna()) < 3:
                    return None
                    
                x = np.arange(len(y_values))
                y = y_values.values
                
                # Filter out nan values
                mask = ~np.isnan(y)
                if sum(mask) < 3:
                    return None
                    
                x = x[mask]
                y = y[mask]
                
                # Linear regression
                slope, _ = np.polyfit(x, y, 1)
                return slope
            
            uptime_trend = calculate_slope(group['uptime'])
            completeness_trend = calculate_slope(group['data_completeness'])
            battery_trend = calculate_slope(group['avg_battery_voltage'])
            signal_trend = calculate_slope(group['avg_signal_strength'])
        
        # Check for warning signs
        warnings = []
        failure_risk_score = 0
        
        # 1. Low uptime
        recent_uptime = group['uptime'].iloc[-1] if not group['uptime'].empty else None
        if recent_uptime is not None and recent_uptime < 70:
            warnings.append(f"Low uptime ({recent_uptime:.1f}%)")
            failure_risk_score += 30
        
        # 2. Declining uptime trend
        if uptime_trend is not None and uptime_trend < -2:
            warnings.append(f"Declining uptime trend ({uptime_trend:.2f} per day)")
            failure_risk_score += 20
        
        # 3. Low data completeness
        recent_completeness = group['data_completeness'].iloc[-1] if not group['data_completeness'].empty else None
        if recent_completeness is not None and recent_completeness < 60:
            warnings.append(f"Low data completeness ({recent_completeness:.1f}%)")
            failure_risk_score += 15
        
        # 4. Low battery voltage
        recent_min_battery = group['min_battery_voltage'].iloc[-1] if not group['min_battery_voltage'].empty else None
        if recent_min_battery is not None and recent_min_battery < 3.5:
            warnings.append(f"Low battery voltage ({recent_min_battery:.2f}V)")
            failure_risk_score += 25
        
        # 5. Declining battery trend
        if battery_trend is not None and battery_trend < -0.05:
            warnings.append(f"Declining battery voltage ({battery_trend:.3f}V per day)")
            failure_risk_score += 20
        
        # 6. Weak signal strength
        recent_signal = group['avg_signal_strength'].iloc[-1] if not group['avg_signal_strength'].empty else None
        if recent_signal is not None and recent_signal < -90:
            warnings.append(f"Weak signal strength ({recent_signal:.0f}dBm)")
            failure_risk_score += 15
        
        # Cap the risk score at 100
        failure_risk_score = min(100, failure_risk_score)
        
        # Determine risk level
        if failure_risk_score >= 70:
            risk_level = "High"
        elif failure_risk_score >= 40:
            risk_level = "Medium"
        elif failure_risk_score >= 20:
            risk_level = "Low"
        else:
            risk_level = "Normal"
        
        # Estimate days until failure (simple heuristic)
        if risk_level == "High":
            days_until_failure = "< 7 days"
        elif risk_level == "Medium":
            days_until_failure = "7-14 days"
        elif risk_level == "Low":
            days_until_failure = "15-30 days"
        else:
            days_until_failure = "> 30 days"
        
        # Add to predictions if there are warnings
        if warnings:
            failure_predictions.append({
                'device_key': device_key,
                'device_id': device_id,
                'risk_level': risk_level,
                'failure_risk_score': failure_risk_score,
                'days_until_failure': days_until_failure,
                'warning_signs': '; '.join(warnings),
                'uptime_trend': uptime_trend,
                'data_completeness_trend': completeness_trend,
                'battery_voltage_trend': battery_trend,
                'signal_strength_trend': signal_trend,
                'calculated_at': datetime.now()
            })
    
    # Create DataFrame from results
    results_df = pd.DataFrame(failure_predictions)
    
    # Save to database (using replace since we want fresh predictions each time)
    if not results_df.empty:
        results_df.to_sql('device_failure_predictions', engine, if_exists='replace', index=False)
        print(f"Saved {len(results_df)} failure predictions to the database")
    else:
        print("No failure predictions generated - no risk devices found")
    
    return len(results_df) if not results_df.empty else 0


with DAG(
    'device_performance_analytics',
    default_args=default_args,
    description='Calculate device performance metrics and analytics',
    schedule_interval=timedelta(hours=1),
    start_date=datetime(2025, 4, 1),
    catchup=False,
    tags=['airqo', 'analytics', 'device_monitoring'],
) as dag:

    # Create tables if they don't exist
    create_tables = PostgresOperator(
        task_id='create_analytics_tables',
        postgres_conn_id='postgres_default',
        sql="""
        -- Table for daily device metrics
        CREATE TABLE IF NOT EXISTS device_daily_metrics (
            id SERIAL PRIMARY KEY,
            device_key INTEGER NOT NULL,
            device_id VARCHAR(100) NOT NULL,
            date DATE NOT NULL,
            uptime FLOAT,
            data_completeness FLOAT,
            readings_count INTEGER,
            expected_readings INTEGER,
            avg_battery_voltage FLOAT,
            min_battery_voltage FLOAT,
            avg_signal_strength FLOAT,
            min_signal_strength FLOAT,
            pm25_avg FLOAT,
            pm10_avg FLOAT,
            pm25_std FLOAT,
            pm10_std FLOAT,
            calculated_at TIMESTAMP,
            UNIQUE(device_key, date)
        );
        
        -- Table for device health scores
        CREATE TABLE IF NOT EXISTS device_health_scores (
            id SERIAL PRIMARY KEY,
            device_key INTEGER NOT NULL,
            device_id VARCHAR(100) NOT NULL,
            health_score FLOAT NOT NULL,
            uptime_score FLOAT,
            data_completeness_score FLOAT,
            battery_health_score FLOAT,
            signal_quality_score FLOAT,
            failure_days_count INTEGER,
            days_analyzed INTEGER,
            uptime_stability FLOAT,
            calculated_at TIMESTAMP,
            UNIQUE(device_key, calculated_at)
        );
        
        -- Table for maintenance effectiveness
        CREATE TABLE IF NOT EXISTS maintenance_effectiveness (
            id SERIAL PRIMARY KEY,
            device_key INTEGER NOT NULL,
            device_id VARCHAR(100) NOT NULL,
            maintenance_date TIMESTAMP NOT NULL,
            uptime_before FLOAT,
            uptime_after FLOAT,
            uptime_improvement FLOAT,
            data_completeness_before FLOAT,
            data_completeness_after FLOAT,
            data_completeness_improvement FLOAT,
            days_before INTEGER,
            days_after INTEGER,
            effectiveness_score FLOAT,
            outcome VARCHAR(50),
            calculated_at TIMESTAMP,
            UNIQUE(device_key, maintenance_date)
        );
        
        -- Table for failure predictions
        CREATE TABLE IF NOT EXISTS device_failure_predictions (
            id SERIAL PRIMARY KEY,
            device_key INTEGER NOT NULL,
            device_id VARCHAR(100) NOT NULL,
            risk_level VARCHAR(20) NOT NULL,
            failure_risk_score FLOAT NOT NULL,
            days_until_failure VARCHAR(20),
            warning_signs TEXT,
            uptime_trend FLOAT,
            data_completeness_trend FLOAT,
            battery_voltage_trend FLOAT,
            signal_strength_trend FLOAT,
            calculated_at TIMESTAMP
        );
        
        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_daily_metrics_device_date ON device_daily_metrics(device_key, date);
        CREATE INDEX IF NOT EXISTS idx_health_scores_device ON device_health_scores(device_key);
        CREATE INDEX IF NOT EXISTS idx_maintenance_device_date ON maintenance_effectiveness(device_key, maintenance_date);
        CREATE INDEX IF NOT EXISTS idx_failure_predictions_device ON device_failure_predictions(device_key);
        """
    )
    
    # Calculate daily metrics for each device
    calculate_daily_metrics_task = PythonOperator(
        task_id='calculate_daily_metrics',
        python_callable=calculate_device_daily_metrics,
    )
    
    # Calculate device health scores
    calculate_health_scores_task = PythonOperator(
        task_id='calculate_health_scores',
        python_callable=calculate_device_health_scores,
    )
    
    # Analyze maintenance effectiveness
    analyze_maintenance_task = PythonOperator(
        task_id='analyze_maintenance_effectiveness',
        python_callable=analyze_maintenance_effectiveness,
    )
    
    # Predict potential device failures
    predict_failures_task = PythonOperator(
        task_id='predict_device_failures',
        python_callable=calculate_failure_predictions,
    )
    
    # Clean up old records to prevent table bloat
    cleanup_old_records = PostgresOperator(
        task_id='cleanup_old_records',
        postgres_conn_id='postgres_default',
        sql="""
        -- Keep only the last 90 days of daily metrics
        DELETE FROM device_daily_metrics
        WHERE date < NOW() - INTERVAL '90 days';
        
        -- Keep only the last 30 days of health scores (one per day)
        DELETE FROM device_health_scores
        WHERE calculated_at < (
            SELECT calculated_at FROM device_health_scores
            ORDER BY calculated_at DESC
            OFFSET 30 LIMIT 1
        );
        
        -- Keep maintenance effectiveness data for 180 days
        DELETE FROM maintenance_effectiveness
        WHERE maintenance_date < NOW() - INTERVAL '180 days';
        """
    )
    
    # Set up the task dependencies
    create_tables >> calculate_daily_metrics_task >> calculate_health_scores_task
    calculate_daily_metrics_task >> analyze_maintenance_task
    
    # Failure prediction depends on daily metrics and health scores
    [calculate_health_scores_task, analyze_maintenance_task] >> predict_failures_task
    
    # Cleanup runs after all analytics
    predict_failures_task >> cleanup_old_records