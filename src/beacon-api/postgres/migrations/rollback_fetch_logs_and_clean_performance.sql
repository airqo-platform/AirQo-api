-- Rollback Script: Remove Fetch Logs and Unique Constraints
-- Date: 2025-11-08
-- Description: Rollback the fetch log migration if needed

-- ============================================================================
-- STEP 1: Drop triggers
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Dropping triggers...';
END $$;

DROP TRIGGER IF EXISTS update_fetch_log_device_updated_at ON fetch_log_device;
DROP TRIGGER IF EXISTS update_fetch_log_airqloud_updated_at ON fetch_log_airqloud;

DO $$
BEGIN
    RAISE NOTICE 'Triggers dropped successfully';
END $$;

-- ============================================================================
-- STEP 2: Drop indexes
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Dropping indexes...';
END $$;

DROP INDEX IF EXISTS idx_fetch_log_device_id;
DROP INDEX IF EXISTS idx_fetch_log_device_dates;
DROP INDEX IF EXISTS idx_fetch_log_device_complete;

DROP INDEX IF EXISTS idx_fetch_log_airqloud_id;
DROP INDEX IF EXISTS idx_fetch_log_airqloud_dates;
DROP INDEX IF EXISTS idx_fetch_log_airqloud_complete;

DO $$
BEGIN
    RAISE NOTICE 'Indexes dropped successfully';
END $$;

-- ============================================================================
-- STEP 3: Drop fetch log tables
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Dropping fetch log tables...';
END $$;

DROP TABLE IF EXISTS fetch_log_device CASCADE;
DROP TABLE IF EXISTS fetch_log_airqloud CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Fetch log tables dropped successfully';
END $$;

-- ============================================================================
-- STEP 4: Remove unique constraints from performance tables
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Removing unique constraints from performance tables...';
END $$;

ALTER TABLE fact_device_performance 
DROP CONSTRAINT IF EXISTS uq_device_performance_id_timestamp;

ALTER TABLE fact_airqloud_performance 
DROP CONSTRAINT IF EXISTS uq_airqloud_performance_id_timestamp;

DO $$
BEGIN
    RAISE NOTICE 'Unique constraints removed successfully';
END $$;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Rollback completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Triggers dropped';
    RAISE NOTICE '  - Indexes dropped';
    RAISE NOTICE '  - Fetch log tables dropped';
    RAISE NOTICE '  - Unique constraints removed';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'WARNING: Performance data was NOT restored';
    RAISE NOTICE 'You will need to re-fetch all data';
    RAISE NOTICE '========================================';
END $$;
