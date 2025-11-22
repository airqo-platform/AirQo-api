# Database Migration Guide

## Overview
These SQL scripts implement the fetch log system to prevent repetitive data retrieval and recalculation.

## Files
- `add_fetch_logs_and_clean_performance.sql` - Main migration script
- `rollback_fetch_logs_and_clean_performance.sql` - Rollback script (if needed)

## What the Migration Does

### 1. Deletes All Performance Data
- Clears `fact_device_performance` table
- Clears `fact_airqloud_performance` table
- Resets auto-increment sequences to 1

### 2. Adds Unique Constraints
- `fact_device_performance`: Unique on `(device_id, timestamp)`
- `fact_airqloud_performance`: Unique on `(airqloud_id, timestamp)`
- Prevents duplicate performance records

### 3. Creates Fetch Log Tables
- `fetch_log_device`: Tracks device data fetches
- `fetch_log_airqloud`: Tracks airqloud calculations
- Each with unique constraints on `(id, start_date, end_date)`

### 4. Creates Indexes
- Optimized for date range queries
- Filtered indexes on completion status

### 5. Creates Triggers
- Auto-updates `updated_at` timestamps

## How to Run

### Using psql (Command Line)

```powershell
# Connect to your database
psql -U your_username -d beacon_db

# Run the migration
\i postgres/migrations/add_fetch_logs_and_clean_performance.sql

# Check the output for success messages
```

### Using pgAdmin or DBeaver

1. Open the SQL file in your database tool
2. Execute the entire script
3. Check the Messages tab for success notifications

### Using Python Script

```python
from app.configs.database import engine
from sqlalchemy import text

# Read the migration file
with open('postgres/migrations/add_fetch_logs_and_clean_performance.sql', 'r') as f:
    migration_sql = f.read()

# Execute the migration
with engine.connect() as conn:
    conn.execute(text(migration_sql))
    conn.commit()
    
print("Migration completed successfully!")
```

### Using Docker

```powershell
# If your database is in Docker
docker exec -i postgres_container psql -U your_username -d beacon_db < postgres/migrations/add_fetch_logs_and_clean_performance.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check if fetch log tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('fetch_log_device', 'fetch_log_airqloud');

-- Check unique constraints
SELECT constraint_name, table_name 
FROM information_schema.table_constraints 
WHERE constraint_name LIKE 'uq_%performance%';

-- Verify performance tables are empty
SELECT COUNT(*) FROM fact_device_performance;  -- Should return 0
SELECT COUNT(*) FROM fact_airqloud_performance;  -- Should return 0

-- Check fetch log tables structure
\d fetch_log_device
\d fetch_log_airqloud
```

## Next Steps

After successful migration:

1. **Start fetching new data** using the enhanced script:
   ```powershell
   python cronjobs/performance_jobs/fetch_thingspeak_data_v2.py --days 30
   ```

2. **Monitor the fetch logs** to see the system working:
   ```sql
   -- Check what's been fetched
   SELECT device_id, start_date, end_date, complete 
   FROM fetch_log_device 
   ORDER BY created_at DESC 
   LIMIT 10;
   
   -- Check airqloud logs
   SELECT airqloud_id, start_date, end_date, complete 
   FROM fetch_log_airqloud 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Verify no duplicates** are being created:
   ```sql
   -- This should return 0
   SELECT device_id, timestamp, COUNT(*) 
   FROM fact_device_performance 
   GROUP BY device_id, timestamp 
   HAVING COUNT(*) > 1;
   ```

## Rollback

If you need to rollback the migration:

```powershell
psql -U your_username -d beacon_db -f postgres/migrations/rollback_fetch_logs_and_clean_performance.sql
```

**⚠️ WARNING:** Rollback does NOT restore deleted performance data. You will need to re-fetch all data.

## Troubleshooting

### Error: "relation already exists"
The script uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't happen. If it does, the tables already exist.

### Error: "constraint already exists"
Check if the migration was already run:
```sql
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE constraint_name IN ('uq_device_performance_id_timestamp', 'uq_airqloud_performance_id_timestamp');
```

### Error: "foreign key constraint violation"
Make sure all referenced tables (`dim_device`, `dim_airqloud`) exist and have data.

## Performance Impact

- **Positive**: Reduced redundant API calls (saves time and API quota)
- **Positive**: No duplicate data in database (saves storage)
- **Minimal**: Small overhead for checking fetch logs (negligible)
- **Index usage**: Optimized for fast lookups

## Backup Recommendation

Before running the migration in production:

```sql
-- Backup performance data (optional, if you want to keep it)
CREATE TABLE fact_device_performance_backup AS 
SELECT * FROM fact_device_performance;

CREATE TABLE fact_airqloud_performance_backup AS 
SELECT * FROM fact_airqloud_performance;
```

Then drop the backups after verifying the new system works:

```sql
DROP TABLE fact_device_performance_backup;
DROP TABLE fact_airqloud_performance_backup;
```
