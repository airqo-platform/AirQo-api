-- Migration Script: Ensure Database Structure Matches 01-init.sql
-- This script is idempotent and will update existing structures to match the target state.

-- 1. Set Timezone
-- DO $$
-- BEGIN
--     EXECUTE 'ALTER DATABASE ' || quote_ident(current_database()) || ' SET timezone TO ''UTC''';
-- END$$;
SET timezone = 'UTC';

-- 2. Create Enum Types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'firmware_download_state_enum') THEN
        CREATE TYPE firmware_download_state_enum AS ENUM ('updated', 'pending', 'failed');
    END IF;
END$$;

-- 3. Create Tables and Columns

-- Helper procedure to add column if not exists (optional, but using standard SQL below)

-- Table: dim_device
CREATE TABLE IF NOT EXISTS dim_device (
    device_key SERIAL PRIMARY KEY
);

ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS device_name VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS site_id VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS network VARCHAR(50);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS mount_type VARCHAR(50);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS power_type VARCHAR(50);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS height FLOAT;
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS next_maintenance TIMESTAMP WITH TIME ZONE;
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS read_key VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS channel_id INTEGER;
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS write_key VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS network_id VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS current_firmware VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS previous_firmware VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS target_firmware VARCHAR(100);
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS file_upload_state BOOLEAN DEFAULT FALSE;
ALTER TABLE dim_device ADD COLUMN IF NOT EXISTS firmware_download_state firmware_download_state_enum DEFAULT 'updated';

-- Constraints for dim_device
DO $$
BEGIN
    -- Unique device_id
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_device_device_id_key') THEN
        ALTER TABLE dim_device ADD CONSTRAINT dim_device_device_id_key UNIQUE (device_id);
    END IF;
    -- Unique read_key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_device_read_key_key') THEN
        ALTER TABLE dim_device ADD CONSTRAINT dim_device_read_key_key UNIQUE (read_key);
    END IF;
    -- Unique channel_id
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_device_channel_id_key') THEN
        ALTER TABLE dim_device ADD CONSTRAINT dim_device_channel_id_key UNIQUE (channel_id);
    END IF;
    -- Unique write_key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_device_write_key_key') THEN
        ALTER TABLE dim_device ADD CONSTRAINT dim_device_write_key_key UNIQUE (write_key);
    END IF;
    -- Check height
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_device_height') THEN
        ALTER TABLE dim_device ADD CONSTRAINT chk_device_height CHECK (height IS NULL OR height >= 0);
    END IF;
    -- Not Null constraints (using ALTER COLUMN SET NOT NULL)
    ALTER TABLE dim_device ALTER COLUMN device_id SET NOT NULL;
    ALTER TABLE dim_device ALTER COLUMN device_name SET NOT NULL;
END$$;


-- Table: dim_site
CREATE TABLE IF NOT EXISTS dim_site (
    site_key SERIAL PRIMARY KEY
);

ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS site_id VARCHAR(100);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS site_name VARCHAR(100);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS search_name VARCHAR(255);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS village VARCHAR(255);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS town VARCHAR(255);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS district VARCHAR(255);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS country VARCHAR(255) DEFAULT 'Uganda';
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS data_provider VARCHAR(100);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS site_category VARCHAR(100);
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS latitude FLOAT;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS longitude FLOAT;
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_site ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for dim_site
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_dim_site_site_id') THEN
        ALTER TABLE dim_site ADD CONSTRAINT uq_dim_site_site_id UNIQUE (site_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_site_latitude') THEN
        ALTER TABLE dim_site ADD CONSTRAINT chk_site_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_site_longitude') THEN
        ALTER TABLE dim_site ADD CONSTRAINT chk_site_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
    END IF;
    ALTER TABLE dim_site ALTER COLUMN site_id SET NOT NULL;
    ALTER TABLE dim_site ALTER COLUMN site_name SET NOT NULL;
END$$;


-- Table: dim_location
CREATE TABLE IF NOT EXISTS dim_location (
    location_key SERIAL PRIMARY KEY
);

ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS device_key INTEGER;
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS latitude FLOAT;
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS longitude FLOAT;
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS site_id VARCHAR(100);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS location_name VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS search_name VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS village VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS town VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS district VARCHAR(255);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS country VARCHAR(255) DEFAULT 'Uganda';
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS admin_level_country VARCHAR(100);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS admin_level_city VARCHAR(100);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS admin_level_division VARCHAR(100);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS site_category VARCHAR(100);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS data_provider VARCHAR(100);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS mount_type VARCHAR(50);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS power_type VARCHAR(50);
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS deployment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP WITH TIME ZONE;
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE dim_location ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for dim_location
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_location_device_key_fkey') THEN
        ALTER TABLE dim_location ADD CONSTRAINT dim_location_device_key_fkey FOREIGN KEY (device_key) REFERENCES dim_device(device_key) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_location_latitude') THEN
        ALTER TABLE dim_location ADD CONSTRAINT chk_location_latitude CHECK (latitude >= -90 AND latitude <= 90);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_location_longitude') THEN
        ALTER TABLE dim_location ADD CONSTRAINT chk_location_longitude CHECK (longitude >= -180 AND longitude <= 180);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_location_effective_dates') THEN
        ALTER TABLE dim_location ADD CONSTRAINT chk_location_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_location_active_end_date') THEN
        ALTER TABLE dim_location ADD CONSTRAINT chk_location_active_end_date CHECK ((is_active = TRUE AND effective_to IS NULL) OR (is_active = FALSE AND effective_to IS NOT NULL));
    END IF;
    ALTER TABLE dim_location ALTER COLUMN device_key SET NOT NULL;
    ALTER TABLE dim_location ALTER COLUMN latitude SET NOT NULL;
    ALTER TABLE dim_location ALTER COLUMN longitude SET NOT NULL;
END$$;


-- Table: dim_category
CREATE TABLE IF NOT EXISTS dim_category (
    name VARCHAR(100) PRIMARY KEY
);

ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS description VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field1 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field2 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field3 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field4 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field5 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field6 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field7 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field8 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field9 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field10 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field11 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field12 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field13 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field14 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS field15 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata1 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata2 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata3 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata4 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata5 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata6 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata7 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata8 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata9 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata10 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata11 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata12 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata13 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata14 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS metadata15 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config1 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config2 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config3 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config4 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config5 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config6 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config7 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config8 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config9 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS config10 VARCHAR(100);
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_category ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();


-- Table: dim_firmware
CREATE TABLE IF NOT EXISTS dim_firmware (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(100);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS firmware_string VARCHAR(100);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS firmware_string_hex VARCHAR(100);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS firmware_string_bootloader VARCHAR(100);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS firmware_type VARCHAR(50) DEFAULT 'beta';
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS description VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS crc32 VARCHAR(100);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS firmware_bin_size INTEGER;
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change1 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change2 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change3 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change4 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change5 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change6 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change7 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change8 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change9 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS change10 VARCHAR(255);
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE dim_firmware ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for dim_firmware
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_firmware_firmware_version_key') THEN
        ALTER TABLE dim_firmware ADD CONSTRAINT dim_firmware_firmware_version_key UNIQUE (firmware_version);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_firmware_type') THEN
        ALTER TABLE dim_firmware ADD CONSTRAINT chk_firmware_type CHECK (firmware_type IN ('stable', 'beta', 'deprecated', 'legacy'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_firmware_bin_size') THEN
        ALTER TABLE dim_firmware ADD CONSTRAINT chk_firmware_bin_size CHECK (firmware_bin_size IS NULL OR firmware_bin_size > 0);
    END IF;
    ALTER TABLE dim_firmware ALTER COLUMN firmware_version SET NOT NULL;
    ALTER TABLE dim_firmware ALTER COLUMN firmware_string SET NOT NULL;
END$$;


-- Table: dim_airqloud
CREATE TABLE IF NOT EXISTS dim_airqloud (
    id TEXT PRIMARY KEY
);

ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS network TEXT;
ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS visibility BOOLEAN;
ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;
ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE dim_airqloud ADD COLUMN IF NOT EXISTS number_of_devices INT;


-- Table: dim_airqloud_device
CREATE TABLE IF NOT EXISTS dim_airqloud_device (
    id TEXT PRIMARY KEY
);

ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS cohort_id TEXT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS long_name TEXT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS device_number INT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS is_active BOOLEAN;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS is_online BOOLEAN;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS network TEXT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS raw_online_status TEXT;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS last_raw_data TIMESTAMPTZ;
ALTER TABLE dim_airqloud_device ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Constraints for dim_airqloud_device
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dim_airqloud_device_cohort_id_fkey') THEN
        ALTER TABLE dim_airqloud_device ADD CONSTRAINT dim_airqloud_device_cohort_id_fkey FOREIGN KEY (cohort_id) REFERENCES dim_airqloud(id);
    END IF;
END$$;


-- Table: config_values
CREATE TABLE IF NOT EXISTS config_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE config_values ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config1 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config2 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config3 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config4 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config5 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config6 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config7 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config8 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config9 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config10 VARCHAR(100);
ALTER TABLE config_values ADD COLUMN IF NOT EXISTS config_updated BOOLEAN DEFAULT FALSE;

-- Constraints for config_values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_config_values_device') THEN
        ALTER TABLE config_values ADD CONSTRAINT fk_config_values_device FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE;
    END IF;
    ALTER TABLE config_values ALTER COLUMN device_id SET NOT NULL;
END$$;


-- Table: metadata_values
CREATE TABLE IF NOT EXISTS metadata_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata1 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata2 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata3 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata4 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata5 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata6 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata7 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata8 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata9 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata10 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata11 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata12 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata13 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata14 VARCHAR(100);
ALTER TABLE metadata_values ADD COLUMN IF NOT EXISTS metadata15 VARCHAR(100);

-- Constraints for metadata_values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_metadata_values_device') THEN
        ALTER TABLE metadata_values ADD CONSTRAINT fk_metadata_values_device FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE;
    END IF;
    ALTER TABLE metadata_values ALTER COLUMN device_id SET NOT NULL;
END$$;


-- Table: field_values
CREATE TABLE IF NOT EXISTS field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE field_values ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS entry_id INTEGER;
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field1 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field2 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field3 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field4 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field5 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field6 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field7 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field8 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field9 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field10 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field11 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field12 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field13 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field14 VARCHAR(100);
ALTER TABLE field_values ADD COLUMN IF NOT EXISTS field15 VARCHAR(100);

-- Constraints for field_values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_field_values_device') THEN
        ALTER TABLE field_values ADD CONSTRAINT fk_field_values_device FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE;
    END IF;
    ALTER TABLE field_values ALTER COLUMN device_id SET NOT NULL;
END$$;


-- Table: device_files
CREATE TABLE IF NOT EXISTS device_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE device_files ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE device_files ADD COLUMN IF NOT EXISTS file VARCHAR(100);
ALTER TABLE device_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for device_files
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_device_files_device') THEN
        ALTER TABLE device_files ADD CONSTRAINT fk_device_files_device FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE;
    END IF;
    ALTER TABLE device_files ALTER COLUMN device_id SET NOT NULL;
    ALTER TABLE device_files ALTER COLUMN file SET NOT NULL;
END$$;


-- Table: fact_device_status
CREATE TABLE IF NOT EXISTS fact_device_status (
    status_key SERIAL PRIMARY KEY
);

ALTER TABLE fact_device_status ADD COLUMN IF NOT EXISTS device_key INTEGER;
ALTER TABLE fact_device_status ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE fact_device_status ADD COLUMN IF NOT EXISTS is_online BOOLEAN;
ALTER TABLE fact_device_status ADD COLUMN IF NOT EXISTS device_status VARCHAR(50);
ALTER TABLE fact_device_status ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fact_device_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fact_device_status_device_key_fkey') THEN
        ALTER TABLE fact_device_status ADD CONSTRAINT fact_device_status_device_key_fkey FOREIGN KEY (device_key) REFERENCES dim_device(device_key) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_status_timestamp') THEN
        ALTER TABLE fact_device_status ADD CONSTRAINT chk_status_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour');
    END IF;
    ALTER TABLE fact_device_status ALTER COLUMN device_key SET NOT NULL;
    ALTER TABLE fact_device_status ALTER COLUMN timestamp SET NOT NULL;
END$$;


-- Table: fact_device_readings
CREATE TABLE IF NOT EXISTS fact_device_readings (
    reading_key SERIAL PRIMARY KEY
);

ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS device_key INTEGER;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS pm2_5 FLOAT;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS pm10 FLOAT;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS temperature FLOAT;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS humidity FLOAT;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS latitude FLOAT;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS longitude FLOAT;
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS frequency VARCHAR(20);
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS network VARCHAR(50);
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);
ALTER TABLE fact_device_readings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fact_device_readings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fact_device_readings_device_key_fkey') THEN
        ALTER TABLE fact_device_readings ADD CONSTRAINT fact_device_readings_device_key_fkey FOREIGN KEY (device_key) REFERENCES dim_device(device_key) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_readings_pm_values') THEN
        ALTER TABLE fact_device_readings ADD CONSTRAINT chk_readings_pm_values CHECK ((pm2_5 IS NULL OR pm2_5 >= 0) AND (pm10 IS NULL OR pm10 >= 0));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_readings_humidity') THEN
        ALTER TABLE fact_device_readings ADD CONSTRAINT chk_readings_humidity CHECK (humidity IS NULL OR (humidity >= 0 AND humidity <= 100));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_readings_coordinates') THEN
        ALTER TABLE fact_device_readings ADD CONSTRAINT chk_readings_coordinates CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180));
    END IF;
    ALTER TABLE fact_device_readings ALTER COLUMN device_key SET NOT NULL;
END$$;


-- Table: fact_health_tips
CREATE TABLE IF NOT EXISTS fact_health_tips (
    tip_key SERIAL PRIMARY KEY
);

ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS reading_key INTEGER;
ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS tip_id VARCHAR(100);
ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS aqi_category VARCHAR(50);
ALTER TABLE fact_health_tips ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fact_health_tips
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fact_health_tips_reading_key_fkey') THEN
        ALTER TABLE fact_health_tips ADD CONSTRAINT fact_health_tips_reading_key_fkey FOREIGN KEY (reading_key) REFERENCES fact_device_readings(reading_key) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_health_tips_aqi') THEN
        ALTER TABLE fact_health_tips ADD CONSTRAINT chk_health_tips_aqi CHECK (aqi_category IN ('Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'));
    END IF;
    ALTER TABLE fact_health_tips ALTER COLUMN reading_key SET NOT NULL;
    ALTER TABLE fact_health_tips ALTER COLUMN tip_id SET NOT NULL;
END$$;


-- Table: fact_device_performance
CREATE TABLE IF NOT EXISTS fact_device_performance (
    performance_key SERIAL PRIMARY KEY
);

ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS freq INTEGER;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS error_margin FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS sum_s1 FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS sum_s2 FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS sum_sq_s1 FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS sum_sq_s2 FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS sum_product FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS avg_battery FLOAT;
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE fact_device_performance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fact_device_performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_performance_device') THEN
        ALTER TABLE fact_device_performance ADD CONSTRAINT fk_performance_device FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_performance_timestamp') THEN
        ALTER TABLE fact_device_performance ADD CONSTRAINT chk_performance_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_device_performance_id_timestamp') THEN
        ALTER TABLE fact_device_performance ADD CONSTRAINT uq_device_performance_id_timestamp UNIQUE (device_id, timestamp);
    END IF;
    ALTER TABLE fact_device_performance ALTER COLUMN device_id SET NOT NULL;
    ALTER TABLE fact_device_performance ALTER COLUMN timestamp SET NOT NULL;
END$$;


-- Table: fact_airqloud_performance
CREATE TABLE IF NOT EXISTS fact_airqloud_performance (
    performance_key SERIAL PRIMARY KEY
);

ALTER TABLE fact_airqloud_performance ADD COLUMN IF NOT EXISTS airqloud_id TEXT;
ALTER TABLE fact_airqloud_performance ADD COLUMN IF NOT EXISTS freq INTEGER;
ALTER TABLE fact_airqloud_performance ADD COLUMN IF NOT EXISTS error_margin FLOAT;
ALTER TABLE fact_airqloud_performance ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE fact_airqloud_performance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fact_airqloud_performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_performance_airqloud') THEN
        ALTER TABLE fact_airqloud_performance ADD CONSTRAINT fk_performance_airqloud FOREIGN KEY (airqloud_id) REFERENCES dim_airqloud(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airqloud_performance_timestamp') THEN
        ALTER TABLE fact_airqloud_performance ADD CONSTRAINT chk_airqloud_performance_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_airqloud_performance_id_timestamp') THEN
        ALTER TABLE fact_airqloud_performance ADD CONSTRAINT uq_airqloud_performance_id_timestamp UNIQUE (airqloud_id, timestamp);
    END IF;
    ALTER TABLE fact_airqloud_performance ALTER COLUMN airqloud_id SET NOT NULL;
    ALTER TABLE fact_airqloud_performance ALTER COLUMN timestamp SET NOT NULL;
END$$;


-- Table: fetch_log_device
CREATE TABLE IF NOT EXISTS fetch_log_device (
    log_id SERIAL PRIMARY KEY
);

ALTER TABLE fetch_log_device ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE fetch_log_device ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE fetch_log_device ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE fetch_log_device ADD COLUMN IF NOT EXISTS complete BOOLEAN DEFAULT FALSE;
ALTER TABLE fetch_log_device ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE fetch_log_device ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fetch_log_device
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fetch_log_device') THEN
        ALTER TABLE fetch_log_device ADD CONSTRAINT fk_fetch_log_device FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_device_fetch_log') THEN
        ALTER TABLE fetch_log_device ADD CONSTRAINT uq_device_fetch_log UNIQUE (device_id, start_date, end_date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_device_fetch_dates') THEN
        ALTER TABLE fetch_log_device ADD CONSTRAINT chk_device_fetch_dates CHECK (start_date <= end_date);
    END IF;
    ALTER TABLE fetch_log_device ALTER COLUMN device_id SET NOT NULL;
    ALTER TABLE fetch_log_device ALTER COLUMN start_date SET NOT NULL;
    ALTER TABLE fetch_log_device ALTER COLUMN end_date SET NOT NULL;
    ALTER TABLE fetch_log_device ALTER COLUMN complete SET NOT NULL;
END$$;

COMMENT ON TABLE fetch_log_device IS 'Tracks which date ranges have been fetched from ThingSpeak for each device to prevent redundant API calls';
COMMENT ON COLUMN fetch_log_device.complete IS 'FALSE if end_date is current day (partial data), TRUE for complete days';


-- Table: fetch_log_airqloud
CREATE TABLE IF NOT EXISTS fetch_log_airqloud (
    log_id SERIAL PRIMARY KEY
);

ALTER TABLE fetch_log_airqloud ADD COLUMN IF NOT EXISTS airqloud_id TEXT;
ALTER TABLE fetch_log_airqloud ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE fetch_log_airqloud ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE fetch_log_airqloud ADD COLUMN IF NOT EXISTS complete BOOLEAN DEFAULT FALSE;
ALTER TABLE fetch_log_airqloud ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE fetch_log_airqloud ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for fetch_log_airqloud
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fetch_log_airqloud') THEN
        ALTER TABLE fetch_log_airqloud ADD CONSTRAINT fk_fetch_log_airqloud FOREIGN KEY (airqloud_id) REFERENCES dim_airqloud(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_airqloud_fetch_log') THEN
        ALTER TABLE fetch_log_airqloud ADD CONSTRAINT uq_airqloud_fetch_log UNIQUE (airqloud_id, start_date, end_date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_airqloud_fetch_dates') THEN
        ALTER TABLE fetch_log_airqloud ADD CONSTRAINT chk_airqloud_fetch_dates CHECK (start_date <= end_date);
    END IF;
    ALTER TABLE fetch_log_airqloud ALTER COLUMN airqloud_id SET NOT NULL;
    ALTER TABLE fetch_log_airqloud ALTER COLUMN start_date SET NOT NULL;
    ALTER TABLE fetch_log_airqloud ALTER COLUMN end_date SET NOT NULL;
    ALTER TABLE fetch_log_airqloud ALTER COLUMN complete SET NOT NULL;
END$$;

COMMENT ON TABLE fetch_log_airqloud IS 'Tracks which date ranges have been calculated for each airqloud to prevent redundant calculations';
COMMENT ON COLUMN fetch_log_airqloud.complete IS 'FALSE if end_date is current day (partial data), TRUE for complete days';


-- Table: items_stock
CREATE TABLE IF NOT EXISTS items_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE items_stock ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE items_stock ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;
ALTER TABLE items_stock ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE items_stock ADD COLUMN IF NOT EXISTS created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE items_stock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for items_stock
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_stock_stock') THEN
        ALTER TABLE items_stock ADD CONSTRAINT chk_items_stock_stock CHECK (stock >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_stock_name_not_empty') THEN
        ALTER TABLE items_stock ADD CONSTRAINT chk_items_stock_name_not_empty CHECK (name IS NOT NULL AND trim(name) != '');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_stock_unit_not_empty') THEN
        ALTER TABLE items_stock ADD CONSTRAINT chk_items_stock_unit_not_empty CHECK (unit IS NOT NULL AND trim(unit) != '');
    END IF;
    ALTER TABLE items_stock ALTER COLUMN name SET NOT NULL;
    ALTER TABLE items_stock ALTER COLUMN stock SET NOT NULL;
    ALTER TABLE items_stock ALTER COLUMN unit SET NOT NULL;
END$$;


-- Table: items_stock_history
CREATE TABLE IF NOT EXISTS items_stock_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS item_id UUID;
ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS old_stock INTEGER;
ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS new_stock INTEGER;
ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS old_unit TEXT;
ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS new_unit TEXT;
ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS change_type VARCHAR(20);
ALTER TABLE items_stock_history ADD COLUMN IF NOT EXISTS changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Constraints for items_stock_history
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_items_stock_history_item') THEN
        ALTER TABLE items_stock_history ADD CONSTRAINT fk_items_stock_history_item FOREIGN KEY (item_id) REFERENCES items_stock(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_stock_history_change_type') THEN
        ALTER TABLE items_stock_history ADD CONSTRAINT chk_items_stock_history_change_type CHECK (change_type IN ('INSERT', 'STOCK_IN', 'STOCK_OUT', 'UNIT_CHANGE', 'DELETE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_stock_history_stock_values') THEN
        ALTER TABLE items_stock_history ADD CONSTRAINT chk_items_stock_history_stock_values CHECK ((old_stock IS NULL OR old_stock >= 0) AND (new_stock >= 0));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_stock_history_unit_not_empty') THEN
        ALTER TABLE items_stock_history ADD CONSTRAINT chk_items_stock_history_unit_not_empty CHECK ((old_unit IS NULL OR trim(old_unit) != '') AND (new_unit IS NOT NULL AND trim(new_unit) != ''));
    END IF;
    ALTER TABLE items_stock_history ALTER COLUMN item_id SET NOT NULL;
    ALTER TABLE items_stock_history ALTER COLUMN new_stock SET NOT NULL;
    ALTER TABLE items_stock_history ALTER COLUMN new_unit SET NOT NULL;
    ALTER TABLE items_stock_history ALTER COLUMN change_type SET NOT NULL;
END$$;


-- Additional Foreign Keys for dim_device
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dim_device_current_firmware') THEN
        ALTER TABLE dim_device ADD CONSTRAINT fk_dim_device_current_firmware FOREIGN KEY (current_firmware) REFERENCES dim_firmware(firmware_version) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dim_device_previous_firmware') THEN
        ALTER TABLE dim_device ADD CONSTRAINT fk_dim_device_previous_firmware FOREIGN KEY (previous_firmware) REFERENCES dim_firmware(firmware_version) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_dim_device_target_firmware') THEN
        ALTER TABLE dim_device ADD CONSTRAINT fk_dim_device_target_firmware FOREIGN KEY (target_firmware) REFERENCES dim_firmware(firmware_version) ON DELETE SET NULL;
    END IF;
END$$;


-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_dim_device_device_id ON dim_device(device_id);
CREATE INDEX IF NOT EXISTS idx_dim_device_status ON dim_device(status);
CREATE INDEX IF NOT EXISTS idx_dim_device_active ON dim_device(is_active);
CREATE INDEX IF NOT EXISTS idx_dim_device_category ON dim_device(category);
CREATE INDEX IF NOT EXISTS idx_dim_device_network ON dim_device(network);
CREATE INDEX IF NOT EXISTS idx_dim_device_read_key ON dim_device(read_key);
CREATE INDEX IF NOT EXISTS idx_dim_device_channel_id ON dim_device(channel_id);
CREATE INDEX IF NOT EXISTS idx_dim_device_write_key ON dim_device(write_key);
CREATE INDEX IF NOT EXISTS idx_dim_device_network_id ON dim_device(network_id);
CREATE INDEX IF NOT EXISTS idx_dim_device_current_firmware ON dim_device(current_firmware);
CREATE INDEX IF NOT EXISTS idx_dim_device_firmware_download_state ON dim_device(firmware_download_state);

CREATE INDEX IF NOT EXISTS idx_dim_site_site_id ON dim_site(site_id);
CREATE INDEX IF NOT EXISTS idx_dim_site_site_name ON dim_site(site_name);
CREATE INDEX IF NOT EXISTS idx_dim_site_city ON dim_site(city);
CREATE INDEX IF NOT EXISTS idx_dim_site_district ON dim_site(district);
CREATE INDEX IF NOT EXISTS idx_dim_site_city_category ON dim_site(city, site_category);

CREATE INDEX IF NOT EXISTS idx_dim_location_device_key ON dim_location(device_key);
CREATE INDEX IF NOT EXISTS idx_dim_location_active ON dim_location(device_key, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_dim_location_coordinates ON dim_location(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_dim_location_site_id ON dim_location(site_id);

CREATE INDEX IF NOT EXISTS idx_dim_category_created_at ON dim_category(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dim_firmware_id ON dim_firmware(id);
CREATE INDEX IF NOT EXISTS idx_dim_firmware_version ON dim_firmware(firmware_version);
CREATE INDEX IF NOT EXISTS idx_dim_firmware_type ON dim_firmware(firmware_type);
CREATE INDEX IF NOT EXISTS idx_dim_firmware_created_at ON dim_firmware(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dim_airqloud_id ON dim_airqloud(id);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_name ON dim_airqloud(name);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_country ON dim_airqloud(country);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_visibility ON dim_airqloud(visibility);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_is_active ON dim_airqloud(is_active);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_created_at ON dim_airqloud(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_id ON dim_airqloud_device(id);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_cohort_id ON dim_airqloud_device(cohort_id);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_name ON dim_airqloud_device(name);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_is_active ON dim_airqloud_device(is_active);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_is_online ON dim_airqloud_device(is_online);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_status ON dim_airqloud_device(status);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_network ON dim_airqloud_device(network);
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_created_at ON dim_airqloud_device(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_config_values_device_id ON config_values(device_id);
CREATE INDEX IF NOT EXISTS idx_config_values_created_at ON config_values(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_values_config_updated ON config_values(config_updated);

CREATE INDEX IF NOT EXISTS idx_metadata_values_device_id ON metadata_values(device_id);
CREATE INDEX IF NOT EXISTS idx_metadata_values_created_at ON metadata_values(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_values_device_id ON field_values(device_id);
CREATE INDEX IF NOT EXISTS idx_field_values_created_at ON field_values(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_field_values_entry_id ON field_values(entry_id);

CREATE INDEX IF NOT EXISTS idx_device_files_device_id ON device_files(device_id);
CREATE INDEX IF NOT EXISTS idx_device_files_created_at ON device_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_files_file ON device_files(file);

CREATE INDEX IF NOT EXISTS idx_fact_device_status_device_key ON fact_device_status(device_key);
CREATE INDEX IF NOT EXISTS idx_fact_device_status_timestamp ON fact_device_status(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fact_device_status_device_timestamp ON fact_device_status(device_key, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_key ON fact_device_readings(device_key);
CREATE INDEX IF NOT EXISTS idx_fact_device_readings_created_at ON fact_device_readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_device_readings_device_created_at ON fact_device_readings(device_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fact_device_readings_pm2_5 ON fact_device_readings(pm2_5) WHERE pm2_5 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fact_device_readings_pm10 ON fact_device_readings(pm10) WHERE pm10 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fact_health_tips_reading_key ON fact_health_tips(reading_key);
CREATE INDEX IF NOT EXISTS idx_fact_health_tips_aqi_category ON fact_health_tips(aqi_category);

CREATE INDEX IF NOT EXISTS idx_fact_device_performance_device_id ON fact_device_performance(device_id);
CREATE INDEX IF NOT EXISTS idx_fact_device_performance_timestamp ON fact_device_performance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fact_device_performance_device_timestamp ON fact_device_performance(device_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fact_airqloud_performance_airqloud_id ON fact_airqloud_performance(airqloud_id);
CREATE INDEX IF NOT EXISTS idx_fact_airqloud_performance_timestamp ON fact_airqloud_performance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fact_airqloud_performance_airqloud_timestamp ON fact_airqloud_performance(airqloud_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fetch_log_device_id ON fetch_log_device(device_id);
CREATE INDEX IF NOT EXISTS idx_fetch_log_device_dates ON fetch_log_device(device_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fetch_log_device_complete ON fetch_log_device(device_id, complete);

CREATE INDEX IF NOT EXISTS idx_fetch_log_airqloud_id ON fetch_log_airqloud(airqloud_id);
CREATE INDEX IF NOT EXISTS idx_fetch_log_airqloud_dates ON fetch_log_airqloud(airqloud_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fetch_log_airqloud_complete ON fetch_log_airqloud(airqloud_id, complete);

CREATE INDEX IF NOT EXISTS idx_items_stock_id ON items_stock(id);
CREATE INDEX IF NOT EXISTS idx_items_stock_name ON items_stock(name);
CREATE INDEX IF NOT EXISTS idx_items_stock_created_date ON items_stock(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_items_stock_updated_at ON items_stock(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_stock_unit ON items_stock(unit);
CREATE INDEX IF NOT EXISTS idx_items_stock_stock ON items_stock(stock);

CREATE INDEX IF NOT EXISTS idx_items_stock_history_item_id ON items_stock_history(item_id);
CREATE INDEX IF NOT EXISTS idx_items_stock_history_changed_at ON items_stock_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_stock_history_change_type ON items_stock_history(change_type);
CREATE INDEX IF NOT EXISTS idx_items_stock_history_item_changed_at ON items_stock_history(item_id, changed_at DESC);


-- 5. Functions and Triggers

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers (Drop first to ensure idempotency)
DROP TRIGGER IF EXISTS update_dim_device_updated_at ON dim_device;
CREATE TRIGGER update_dim_device_updated_at 
    BEFORE UPDATE ON dim_device 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_category_updated_at ON dim_category;
CREATE TRIGGER update_dim_category_updated_at 
    BEFORE UPDATE ON dim_category 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_firmware_updated_at ON dim_firmware;
CREATE TRIGGER update_dim_firmware_updated_at 
    BEFORE UPDATE ON dim_firmware 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_stock_updated_at ON items_stock;
CREATE TRIGGER update_items_stock_updated_at 
    BEFORE UPDATE ON items_stock 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fetch_log_device_updated_at ON fetch_log_device;
CREATE TRIGGER update_fetch_log_device_updated_at 
    BEFORE UPDATE ON fetch_log_device 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fetch_log_airqloud_updated_at ON fetch_log_airqloud;
CREATE TRIGGER update_fetch_log_airqloud_updated_at 
    BEFORE UPDATE ON fetch_log_airqloud 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Items Stock History Trigger Function
CREATE OR REPLACE FUNCTION track_items_stock_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val VARCHAR(20);
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO items_stock_history (item_id, old_stock, new_stock, old_unit, new_unit, change_type)
        VALUES (NEW.id, NULL, NEW.stock, NULL, NEW.unit, 'INSERT');
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if stock or unit actually changed
        IF OLD.stock != NEW.stock OR OLD.unit != NEW.unit THEN
            -- Determine the type of change
            IF OLD.stock != NEW.stock AND OLD.unit != NEW.unit THEN
                -- Both stock and unit changed - prioritize stock change type
                IF NEW.stock > OLD.stock THEN
                    change_type_val := 'STOCK_IN';
                ELSIF NEW.stock < OLD.stock THEN
                    change_type_val := 'STOCK_OUT';
                ELSE
                    change_type_val := 'UNIT_CHANGE';
                END IF;
            ELSIF OLD.stock != NEW.stock THEN
                -- Only stock changed
                IF NEW.stock > OLD.stock THEN
                    change_type_val := 'STOCK_IN';
                ELSE
                    change_type_val := 'STOCK_OUT';
                END IF;
            ELSE
                -- Only unit changed
                change_type_val := 'UNIT_CHANGE';
            END IF;
            
            INSERT INTO items_stock_history (item_id, old_stock, new_stock, old_unit, new_unit, change_type)
            VALUES (NEW.id, OLD.stock, NEW.stock, OLD.unit, NEW.unit, change_type_val);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO items_stock_history (item_id, old_stock, new_stock, old_unit, new_unit, change_type)
        VALUES (OLD.id, OLD.stock, 0, OLD.unit, OLD.unit, 'DELETE');
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_items_stock_history_insert ON items_stock;
CREATE TRIGGER trigger_items_stock_history_insert
    AFTER INSERT ON items_stock
    FOR EACH ROW EXECUTE FUNCTION track_items_stock_changes();

DROP TRIGGER IF EXISTS trigger_items_stock_history_update ON items_stock;
CREATE TRIGGER trigger_items_stock_history_update
    AFTER UPDATE ON items_stock
    FOR EACH ROW EXECUTE FUNCTION track_items_stock_changes();

DROP TRIGGER IF EXISTS trigger_items_stock_history_delete ON items_stock;
CREATE TRIGGER trigger_items_stock_history_delete
    AFTER DELETE ON items_stock
    FOR EACH ROW EXECUTE FUNCTION track_items_stock_changes();


-- Migration: Change dim_airqloud_device primary key to composite (id, cohort_id)
-- This allows the same device to belong to multiple cohorts
DO $$
BEGIN
    -- Check if we need to migrate (old schema has id as single PK)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'dim_airqloud_device' 
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'dim_airqloud_device_pkey'
    ) THEN
        -- Check if it's the old single-column PK
        IF (
            SELECT COUNT(*) FROM information_schema.key_column_usage 
            WHERE table_name = 'dim_airqloud_device' 
            AND constraint_name = 'dim_airqloud_device_pkey'
        ) = 1 THEN
            -- Delete existing data to allow schema change (will be re-synced)
            DELETE FROM dim_airqloud_device;
            
            -- Drop old primary key
            ALTER TABLE dim_airqloud_device DROP CONSTRAINT dim_airqloud_device_pkey;
            
            -- Make cohort_id NOT NULL
            ALTER TABLE dim_airqloud_device ALTER COLUMN cohort_id SET NOT NULL;
            
            -- Add composite primary key
            ALTER TABLE dim_airqloud_device ADD PRIMARY KEY (id, cohort_id);
            
            RAISE NOTICE 'Migrated dim_airqloud_device to composite primary key (id, cohort_id)';
        END IF;
    END IF;
END$$;

-- Add index for efficient lookups by cohort_id
CREATE INDEX IF NOT EXISTS idx_dim_airqloud_device_composite ON dim_airqloud_device(id, cohort_id);
