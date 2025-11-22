-- Migration Script: Add Fetch Logs and Clean Performance Tables
-- Date: 2025-11-08
-- Description: 
--   1. Delete all existing performance data
--   2. Add unique constraints to prevent duplicates
--   3. Create fetch log tables to track data fetching

-- ============================================================================
-- STEP 1: Delete all existing performance data
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Starting performance data cleanup...';
END $$;

-- Delete all device performance records
DELETE FROM fact_device_performance;

-- Reset the sequence to start from 1
ALTER SEQUENCE fact_device_performance_performance_key_seq RESTART WITH 1;

-- Delete all airqloud performance records
DELETE FROM fact_airqloud_performance;

-- Reset the sequence to start from 1
ALTER SEQUENCE fact_airqloud_performance_performance_key_seq RESTART WITH 1;

DO $$
BEGIN
    RAISE NOTICE 'Performance data deleted successfully';
END $$;

-- ============================================================================
-- STEP 2: Add unique constraints to performance tables
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Adding unique constraints to performance tables...';
END $$;

-- Add unique constraint to fact_device_performance
-- This prevents duplicate entries for the same device and timestamp
ALTER TABLE fact_device_performance 
ADD CONSTRAINT uq_device_performance_id_timestamp 
UNIQUE (device_id, timestamp);

-- Add unique constraint to fact_airqloud_performance
-- This prevents duplicate entries for the same airqloud and timestamp
ALTER TABLE fact_airqloud_performance 
ADD CONSTRAINT uq_airqloud_performance_id_timestamp 
UNIQUE (airqloud_id, timestamp);

DO $$
BEGIN
    RAISE NOTICE 'Unique constraints added successfully';
END $$;

-- ============================================================================
-- STEP 3: Create fetch log tables
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Creating fetch log tables...';
END $$;

-- Create fetch_log_device table
-- Tracks which date ranges have been fetched from ThingSpeak for each device
CREATE TABLE IF NOT EXISTS fetch_log_device (
    log_id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    complete BOOLEAN DEFAULT FALSE NOT NULL,  -- FALSE if end_date is today (incomplete day), TRUE otherwise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_fetch_log_device 
        FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE,
    CONSTRAINT uq_device_fetch_log 
        UNIQUE (device_id, start_date, end_date),
    CONSTRAINT chk_device_fetch_dates 
        CHECK (start_date <= end_date)
);

-- Add table comment
COMMENT ON TABLE fetch_log_device IS 'Tracks which date ranges have been fetched from ThingSpeak for each device to prevent redundant API calls';
COMMENT ON COLUMN fetch_log_device.complete IS 'FALSE if end_date is current day (partial data), TRUE for complete days';

-- Create fetch_log_airqloud table
-- Tracks which date ranges have been calculated for each airqloud
CREATE TABLE IF NOT EXISTS fetch_log_airqloud (
    log_id SERIAL PRIMARY KEY,
    airqloud_id TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    complete BOOLEAN DEFAULT FALSE NOT NULL,  -- FALSE if end_date is today (incomplete day), TRUE otherwise
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_fetch_log_airqloud 
        FOREIGN KEY (airqloud_id) REFERENCES dim_airqloud(id) ON DELETE CASCADE,
    CONSTRAINT uq_airqloud_fetch_log 
        UNIQUE (airqloud_id, start_date, end_date),
    CONSTRAINT chk_airqloud_fetch_dates 
        CHECK (start_date <= end_date)
);

-- Add table comment
COMMENT ON TABLE fetch_log_airqloud IS 'Tracks which date ranges have been calculated for each airqloud to prevent redundant calculations';
COMMENT ON COLUMN fetch_log_airqloud.complete IS 'FALSE if end_date is current day (partial data), TRUE for complete days';

DO $$
BEGIN
    RAISE NOTICE 'Fetch log tables created successfully';
END $$;

-- ============================================================================
-- STEP 4: Create indexes for fetch log tables
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Creating indexes for fetch log tables...';
END $$;

-- Indexes for fetch_log_device
CREATE INDEX IF NOT EXISTS idx_fetch_log_device_id 
    ON fetch_log_device(device_id);

CREATE INDEX IF NOT EXISTS idx_fetch_log_device_dates 
    ON fetch_log_device(device_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_fetch_log_device_complete 
    ON fetch_log_device(device_id, complete);

-- Indexes for fetch_log_airqloud
CREATE INDEX IF NOT EXISTS idx_fetch_log_airqloud_id 
    ON fetch_log_airqloud(airqloud_id);

CREATE INDEX IF NOT EXISTS idx_fetch_log_airqloud_dates 
    ON fetch_log_airqloud(airqloud_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_fetch_log_airqloud_complete 
    ON fetch_log_airqloud(airqloud_id, complete);

DO $$
BEGIN
    RAISE NOTICE 'Indexes created successfully';
END $$;

-- ============================================================================
-- STEP 5: Create triggers for auto-updating updated_at column
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Creating triggers for fetch log tables...';
END $$;

-- Trigger for fetch_log_device
CREATE TRIGGER update_fetch_log_device_updated_at 
    BEFORE UPDATE ON fetch_log_device 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for fetch_log_airqloud
CREATE TRIGGER update_fetch_log_airqloud_updated_at 
    BEFORE UPDATE ON fetch_log_airqloud 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
    RAISE NOTICE 'Triggers created successfully';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Performance data deleted';
    RAISE NOTICE '  - Unique constraints added';
    RAISE NOTICE '  - Fetch log tables created';
    RAISE NOTICE '  - Indexes created';
    RAISE NOTICE '  - Triggers created';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Use fetch_thingspeak_data_v2.py to fetch data';
    RAISE NOTICE '  2. Monitor fetch logs to see efficiency gains';
    RAISE NOTICE '========================================';
END $$;
