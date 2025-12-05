-- Beacon Analytics Database Migration
-- Creates tables and relationships for IoT device analytics
-- Updated to accept all values from AirQo API

SET timezone = 'UTC';

-- Create enum types
CREATE TYPE firmware_download_state_enum AS ENUM ('updated', 'pending', 'failed');

-- Dimension Tables

CREATE TABLE dim_device (
    device_key SERIAL PRIMARY KEY,
    device_id VARCHAR(100) UNIQUE NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    site_id VARCHAR(100),
    network VARCHAR(50),
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'unknown',
    is_online BOOLEAN DEFAULT FALSE,
    mount_type VARCHAR(50),
    power_type VARCHAR(50),
    height FLOAT,
    next_maintenance TIMESTAMP WITH TIME ZONE,
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- New fields
    read_key VARCHAR(100) UNIQUE,
    channel_id INTEGER UNIQUE,
    write_key VARCHAR(100) UNIQUE,
    network_id VARCHAR(100),
    current_firmware VARCHAR(100),
    previous_firmware VARCHAR(100),
    target_firmware VARCHAR(100),
    file_upload_state BOOLEAN DEFAULT FALSE,
    firmware_download_state firmware_download_state_enum DEFAULT 'updated',
    
    -- Only keep the height constraint as it's a logical business rule
    CONSTRAINT chk_device_height CHECK (height IS NULL OR height >= 0)
    -- Removed restrictive constraints for status, category, and network
);

CREATE TABLE dim_site (
    site_key SERIAL PRIMARY KEY,
    site_id VARCHAR(100) NOT NULL,
    site_name VARCHAR(100) NOT NULL,
    location_name VARCHAR(255),
    search_name VARCHAR(255),
    village VARCHAR(255),
    town VARCHAR(255),
    city VARCHAR(255),
    district VARCHAR(255),
    country VARCHAR(255) DEFAULT 'Uganda',
    data_provider VARCHAR(100),
    site_category VARCHAR(100),
    latitude FLOAT,
    longitude FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT uq_dim_site_site_id UNIQUE (site_id),
    CONSTRAINT chk_site_latitude CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    CONSTRAINT chk_site_longitude CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE TABLE dim_location (
    location_key SERIAL PRIMARY KEY,
    device_key INTEGER NOT NULL REFERENCES dim_device(device_key) ON DELETE CASCADE,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    site_id VARCHAR(100),
    site_name VARCHAR(255),
    location_name VARCHAR(255),
    search_name VARCHAR(255),
    village VARCHAR(255),
    town VARCHAR(255),
    city VARCHAR(255),
    district VARCHAR(255),
    country VARCHAR(255) DEFAULT 'Uganda',
    admin_level_country VARCHAR(100),
    admin_level_city VARCHAR(100),
    admin_level_division VARCHAR(100),
    site_category VARCHAR(100),
    data_provider VARCHAR(100),
    mount_type VARCHAR(50),
    power_type VARCHAR(50),
    deployment_date TIMESTAMP WITH TIME ZONE,
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Keep logical constraints only
    CONSTRAINT chk_location_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT chk_location_longitude CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT chk_location_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT chk_location_active_end_date CHECK (
        (is_active = TRUE AND effective_to IS NULL) OR 
        (is_active = FALSE AND effective_to IS NOT NULL)
    )
);

CREATE TABLE dim_category (
    name VARCHAR(100) PRIMARY KEY,
    description VARCHAR(100),
    field1 VARCHAR(100),
    field2 VARCHAR(100),
    field3 VARCHAR(100),
    field4 VARCHAR(100),
    field5 VARCHAR(100),
    field6 VARCHAR(100),
    field7 VARCHAR(100),
    field8 VARCHAR(100),
    field9 VARCHAR(100),
    field10 VARCHAR(100),
    field11 VARCHAR(100),
    field12 VARCHAR(100),
    field13 VARCHAR(100),
    field14 VARCHAR(100),
    field15 VARCHAR(100),
    metadata1 VARCHAR(100),
    metadata2 VARCHAR(100),
    metadata3 VARCHAR(100),
    metadata4 VARCHAR(100),
    metadata5 VARCHAR(100),
    metadata6 VARCHAR(100),
    metadata7 VARCHAR(100),
    metadata8 VARCHAR(100),
    metadata9 VARCHAR(100),
    metadata10 VARCHAR(100),
    metadata11 VARCHAR(100),
    metadata12 VARCHAR(100),
    metadata13 VARCHAR(100),
    metadata14 VARCHAR(100),
    metadata15 VARCHAR(100),
    config1 VARCHAR(100),
    config2 VARCHAR(100),
    config3 VARCHAR(100),
    config4 VARCHAR(100),
    config5 VARCHAR(100),
    config6 VARCHAR(100),
    config7 VARCHAR(100),
    config8 VARCHAR(100),
    config9 VARCHAR(100),
    config10 VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE dim_firmware (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firmware_version VARCHAR(100) UNIQUE NOT NULL,
    firmware_string VARCHAR(100) NOT NULL,
    firmware_string_hex VARCHAR(100),
    firmware_string_bootloader VARCHAR(100),
    firmware_type VARCHAR(50) DEFAULT 'beta',
    description VARCHAR(255),
    crc32 VARCHAR(100),
    firmware_bin_size INTEGER,
    change1 VARCHAR(255),
    change2 VARCHAR(255),
    change3 VARCHAR(255),
    change4 VARCHAR(255),
    change5 VARCHAR(255),
    change6 VARCHAR(255),
    change7 VARCHAR(255),
    change8 VARCHAR(255),
    change9 VARCHAR(255),
    change10 VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_firmware_type CHECK (
        firmware_type IN ('stable', 'beta', 'deprecated', 'legacy')
    ),
    CONSTRAINT chk_firmware_bin_size CHECK (
        firmware_bin_size IS NULL OR firmware_bin_size > 0
    )
);

CREATE TABLE dim_airqloud (
    id TEXT PRIMARY KEY,
    name TEXT,
    country TEXT,
    visibility BOOLEAN,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ,
    number_of_devices INT
);

CREATE TABLE dim_airqloud_device (
    id TEXT PRIMARY KEY,
    cohort_id TEXT REFERENCES dim_airqloud(id),
    name TEXT,
    long_name TEXT,
    device_number INT,
    is_active BOOLEAN,
    is_online BOOLEAN,
    last_active TIMESTAMPTZ,
    status TEXT,
    network TEXT,
    created_at TIMESTAMPTZ
);

CREATE TABLE config_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    config1 VARCHAR(100),
    config2 VARCHAR(100),
    config3 VARCHAR(100),
    config4 VARCHAR(100),
    config5 VARCHAR(100),
    config6 VARCHAR(100),
    config7 VARCHAR(100),
    config8 VARCHAR(100),
    config9 VARCHAR(100),
    config10 VARCHAR(100),
    config_updated BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT fk_config_values_device 
        FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE
);

CREATE TABLE metadata_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata1 VARCHAR(100),
    metadata2 VARCHAR(100),
    metadata3 VARCHAR(100),
    metadata4 VARCHAR(100),
    metadata5 VARCHAR(100),
    metadata6 VARCHAR(100),
    metadata7 VARCHAR(100),
    metadata8 VARCHAR(100),
    metadata9 VARCHAR(100),
    metadata10 VARCHAR(100),
    metadata11 VARCHAR(100),
    metadata12 VARCHAR(100),
    metadata13 VARCHAR(100),
    metadata14 VARCHAR(100),
    metadata15 VARCHAR(100),
    
    CONSTRAINT fk_metadata_values_device 
        FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE
);

CREATE TABLE field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL,
    entry_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    field1 VARCHAR(100),
    field2 VARCHAR(100),
    field3 VARCHAR(100),
    field4 VARCHAR(100),
    field5 VARCHAR(100),
    field6 VARCHAR(100),
    field7 VARCHAR(100),
    field8 VARCHAR(100),
    field9 VARCHAR(100),
    field10 VARCHAR(100),
    field11 VARCHAR(100),
    field12 VARCHAR(100),
    field13 VARCHAR(100),
    field14 VARCHAR(100),
    field15 VARCHAR(100),
    
    CONSTRAINT fk_field_values_device 
        FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE
);

CREATE TABLE device_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(100) NOT NULL,
    file VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_device_files_device 
        FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE
);

-- Fact Tables

CREATE TABLE fact_device_status (
    status_key SERIAL PRIMARY KEY,
    device_key INTEGER NOT NULL REFERENCES dim_device(device_key) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_online BOOLEAN,
    device_status VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Keep timestamp constraint
    CONSTRAINT chk_status_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour')
    -- Removed restrictive device_status constraint
);

CREATE TABLE fact_device_readings (
    reading_key SERIAL PRIMARY KEY,
    device_key INTEGER NOT NULL REFERENCES dim_device(device_key) ON DELETE CASCADE,
    device_id VARCHAR(100),
    pm2_5 FLOAT,
    pm10 FLOAT,
    temperature FLOAT,
    humidity FLOAT,
    latitude FLOAT,
    longitude FLOAT,
    frequency VARCHAR(20),
    network VARCHAR(50),
    site_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Keep logical constraints
    CONSTRAINT chk_readings_pm_values CHECK (
        (pm2_5 IS NULL OR pm2_5 >= 0) AND
        (pm10 IS NULL OR pm10 >= 0)
    ),
    CONSTRAINT chk_readings_humidity CHECK (
        (humidity IS NULL OR (humidity >= 0 AND humidity <= 100))
    ),
    CONSTRAINT chk_readings_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR 
        (latitude IS NOT NULL AND longitude IS NOT NULL AND
         latitude >= -90 AND latitude <= 90 AND
         longitude >= -180 AND longitude <= 180)
    )
);

CREATE TABLE fact_health_tips (
    tip_key SERIAL PRIMARY KEY,
    reading_key INTEGER NOT NULL REFERENCES fact_device_readings(reading_key) ON DELETE CASCADE,
    tip_id VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500),
    aqi_category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_health_tips_aqi CHECK (
        aqi_category IN ('Good', 'Moderate', 'Unhealthy for Sensitive Groups', 
                        'Unhealthy', 'Very Unhealthy', 'Hazardous')
    )
);

CREATE TABLE fact_device_performance (
    performance_key SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    freq INTEGER,
    error_margin FLOAT,
    sum_s1 FLOAT,
    sum_s2 FLOAT,
    sum_sq_s1 FLOAT,
    sum_sq_s2 FLOAT,
    sum_product FLOAT,
    avg_battery FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_performance_device 
        FOREIGN KEY (device_id) REFERENCES dim_device(device_id) ON DELETE CASCADE,
    CONSTRAINT chk_performance_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour'),
    CONSTRAINT uq_device_performance_id_timestamp UNIQUE (device_id, timestamp)
);

CREATE TABLE fact_airqloud_performance (
    performance_key SERIAL PRIMARY KEY,
    airqloud_id TEXT NOT NULL,
    freq INTEGER,
    error_margin FLOAT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_performance_airqloud 
        FOREIGN KEY (airqloud_id) REFERENCES dim_airqloud(id) ON DELETE CASCADE,
    CONSTRAINT chk_airqloud_performance_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour'),
    CONSTRAINT uq_airqloud_performance_id_timestamp UNIQUE (airqloud_id, timestamp)
);

-- Fetch Log Tables (prevent repetitive data retrieval)
-- These tables track which date ranges have been fetched/calculated to avoid redundant API calls

CREATE TABLE fetch_log_device (
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

COMMENT ON TABLE fetch_log_device IS 'Tracks which date ranges have been fetched from ThingSpeak for each device to prevent redundant API calls';
COMMENT ON COLUMN fetch_log_device.complete IS 'FALSE if end_date is current day (partial data), TRUE for complete days';

CREATE TABLE fetch_log_airqloud (
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

COMMENT ON TABLE fetch_log_airqloud IS 'Tracks which date ranges have been calculated for each airqloud to prevent redundant calculations';
COMMENT ON COLUMN fetch_log_airqloud.complete IS 'FALSE if end_date is current day (partial data), TRUE for complete days';

-- Add foreign key constraints for dim_device
-- Note: category field has NO foreign key constraint - it's a simple VARCHAR field
-- This allows devices to have any category value
ALTER TABLE dim_device
    ADD CONSTRAINT fk_dim_device_current_firmware 
        FOREIGN KEY (current_firmware) REFERENCES dim_firmware(firmware_version) ON DELETE SET NULL,
    ADD CONSTRAINT fk_dim_device_previous_firmware 
        FOREIGN KEY (previous_firmware) REFERENCES dim_firmware(firmware_version) ON DELETE SET NULL,
    ADD CONSTRAINT fk_dim_device_target_firmware 
        FOREIGN KEY (target_firmware) REFERENCES dim_firmware(firmware_version) ON DELETE SET NULL;

-- Indexes

CREATE INDEX idx_dim_device_device_id ON dim_device(device_id);
CREATE INDEX idx_dim_device_status ON dim_device(status);
CREATE INDEX idx_dim_device_active ON dim_device(is_active);
CREATE INDEX idx_dim_device_category ON dim_device(category);
CREATE INDEX idx_dim_device_network ON dim_device(network);
CREATE INDEX idx_dim_device_read_key ON dim_device(read_key);
CREATE INDEX idx_dim_device_channel_id ON dim_device(channel_id);
CREATE INDEX idx_dim_device_write_key ON dim_device(write_key);
CREATE INDEX idx_dim_device_network_id ON dim_device(network_id);
CREATE INDEX idx_dim_device_current_firmware ON dim_device(current_firmware);
CREATE INDEX idx_dim_device_firmware_download_state ON dim_device(firmware_download_state);

CREATE INDEX idx_dim_site_site_id ON dim_site(site_id);
CREATE INDEX idx_dim_site_site_name ON dim_site(site_name);
CREATE INDEX idx_dim_site_city ON dim_site(city);
CREATE INDEX idx_dim_site_district ON dim_site(district);
CREATE INDEX idx_dim_site_city_category ON dim_site(city, site_category);

CREATE INDEX idx_dim_location_device_key ON dim_location(device_key);
CREATE INDEX idx_dim_location_active ON dim_location(device_key, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_dim_location_coordinates ON dim_location(latitude, longitude);
CREATE INDEX idx_dim_location_site_id ON dim_location(site_id);

CREATE INDEX idx_dim_category_created_at ON dim_category(created_at DESC);

CREATE INDEX idx_dim_firmware_id ON dim_firmware(id);
CREATE INDEX idx_dim_firmware_version ON dim_firmware(firmware_version);
CREATE INDEX idx_dim_firmware_type ON dim_firmware(firmware_type);
CREATE INDEX idx_dim_firmware_created_at ON dim_firmware(created_at DESC);

CREATE INDEX idx_dim_airqloud_id ON dim_airqloud(id);
CREATE INDEX idx_dim_airqloud_name ON dim_airqloud(name);
CREATE INDEX idx_dim_airqloud_country ON dim_airqloud(country);
CREATE INDEX idx_dim_airqloud_visibility ON dim_airqloud(visibility);
CREATE INDEX idx_dim_airqloud_is_active ON dim_airqloud(is_active);
CREATE INDEX idx_dim_airqloud_created_at ON dim_airqloud(created_at DESC);

CREATE INDEX idx_dim_airqloud_device_id ON dim_airqloud_device(id);
CREATE INDEX idx_dim_airqloud_device_cohort_id ON dim_airqloud_device(cohort_id);
CREATE INDEX idx_dim_airqloud_device_name ON dim_airqloud_device(name);
CREATE INDEX idx_dim_airqloud_device_is_active ON dim_airqloud_device(is_active);
CREATE INDEX idx_dim_airqloud_device_is_online ON dim_airqloud_device(is_online);
CREATE INDEX idx_dim_airqloud_device_status ON dim_airqloud_device(status);
CREATE INDEX idx_dim_airqloud_device_network ON dim_airqloud_device(network);
CREATE INDEX idx_dim_airqloud_device_created_at ON dim_airqloud_device(created_at DESC);

CREATE INDEX idx_config_values_device_id ON config_values(device_id);
CREATE INDEX idx_config_values_created_at ON config_values(created_at DESC);
CREATE INDEX idx_config_values_config_updated ON config_values(config_updated);

CREATE INDEX idx_metadata_values_device_id ON metadata_values(device_id);
CREATE INDEX idx_metadata_values_created_at ON metadata_values(created_at DESC);

CREATE INDEX idx_field_values_device_id ON field_values(device_id);
CREATE INDEX idx_field_values_created_at ON field_values(created_at DESC);
CREATE INDEX idx_field_values_entry_id ON field_values(entry_id);

CREATE INDEX idx_device_files_device_id ON device_files(device_id);
CREATE INDEX idx_device_files_created_at ON device_files(created_at DESC);
CREATE INDEX idx_device_files_file ON device_files(file);

CREATE INDEX idx_fact_device_status_device_key ON fact_device_status(device_key);
CREATE INDEX idx_fact_device_status_timestamp ON fact_device_status(timestamp DESC);
CREATE INDEX idx_fact_device_status_device_timestamp ON fact_device_status(device_key, timestamp DESC);

CREATE INDEX idx_fact_device_readings_device_key ON fact_device_readings(device_key);
CREATE INDEX idx_fact_device_readings_created_at ON fact_device_readings(created_at DESC);
CREATE INDEX idx_fact_device_readings_device_created_at ON fact_device_readings(device_key, created_at DESC);
CREATE INDEX idx_fact_device_readings_s1_pm2_5 ON fact_device_readings(s1_pm2_5) WHERE s1_pm2_5 IS NOT NULL;
CREATE INDEX idx_fact_device_readings_s2_pm2_5 ON fact_device_readings(s2_pm2_5) WHERE s2_pm2_5 IS NOT NULL;
CREATE INDEX idx_fact_device_readings_category ON fact_device_readings(device_category);

CREATE INDEX idx_fact_health_tips_reading_key ON fact_health_tips(reading_key);
CREATE INDEX idx_fact_health_tips_aqi_category ON fact_health_tips(aqi_category);

CREATE INDEX idx_fact_device_performance_device_id ON fact_device_performance(device_id);
CREATE INDEX idx_fact_device_performance_timestamp ON fact_device_performance(timestamp DESC);
CREATE INDEX idx_fact_device_performance_device_timestamp ON fact_device_performance(device_id, timestamp DESC);

CREATE INDEX idx_fact_airqloud_performance_airqloud_id ON fact_airqloud_performance(airqloud_id);
CREATE INDEX idx_fact_airqloud_performance_timestamp ON fact_airqloud_performance(timestamp DESC);
CREATE INDEX idx_fact_airqloud_performance_airqloud_timestamp ON fact_airqloud_performance(airqloud_id, timestamp DESC);

CREATE INDEX idx_fetch_log_device_id ON fetch_log_device(device_id);
CREATE INDEX idx_fetch_log_device_dates ON fetch_log_device(device_id, start_date, end_date);
CREATE INDEX idx_fetch_log_device_complete ON fetch_log_device(device_id, complete);

CREATE INDEX idx_fetch_log_airqloud_id ON fetch_log_airqloud(airqloud_id);
CREATE INDEX idx_fetch_log_airqloud_dates ON fetch_log_airqloud(airqloud_id, start_date, end_date);
CREATE INDEX idx_fetch_log_airqloud_complete ON fetch_log_airqloud(airqloud_id, complete);

-- Items Stock Management Tables

CREATE TABLE items_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_items_stock_stock CHECK (stock >= 0),
    CONSTRAINT chk_items_stock_name_not_empty CHECK (name IS NOT NULL AND trim(name) != ''),
    CONSTRAINT chk_items_stock_unit_not_empty CHECK (unit IS NOT NULL AND trim(unit) != '')
);

CREATE TABLE items_stock_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    old_stock INTEGER,
    new_stock INTEGER NOT NULL,
    old_unit TEXT,
    new_unit TEXT NOT NULL,
    change_type VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_items_stock_history_item 
        FOREIGN KEY (item_id) REFERENCES items_stock(id) ON DELETE CASCADE,
    CONSTRAINT chk_items_stock_history_change_type 
        CHECK (change_type IN ('INSERT', 'STOCK_IN', 'STOCK_OUT', 'UNIT_CHANGE', 'DELETE')),
    CONSTRAINT chk_items_stock_history_stock_values 
        CHECK ((old_stock IS NULL OR old_stock >= 0) AND (new_stock >= 0)),
    CONSTRAINT chk_items_stock_history_unit_not_empty 
        CHECK ((old_unit IS NULL OR trim(old_unit) != '') AND (new_unit IS NOT NULL AND trim(new_unit) != ''))
);

-- Indexes for Items Stock Tables

CREATE INDEX idx_items_stock_id ON items_stock(id);
CREATE INDEX idx_items_stock_name ON items_stock(name);
CREATE INDEX idx_items_stock_created_date ON items_stock(created_date DESC);
CREATE INDEX idx_items_stock_updated_at ON items_stock(updated_at DESC);
CREATE INDEX idx_items_stock_unit ON items_stock(unit);
CREATE INDEX idx_items_stock_stock ON items_stock(stock);

CREATE INDEX idx_items_stock_history_item_id ON items_stock_history(item_id);
CREATE INDEX idx_items_stock_history_changed_at ON items_stock_history(changed_at DESC);
CREATE INDEX idx_items_stock_history_change_type ON items_stock_history(change_type);
CREATE INDEX idx_items_stock_history_item_changed_at ON items_stock_history(item_id, changed_at DESC);

-- Triggers (unchanged)

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dim_device_updated_at 
    BEFORE UPDATE ON dim_device 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_category_updated_at 
    BEFORE UPDATE ON dim_category 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dim_firmware_updated_at 
    BEFORE UPDATE ON dim_firmware 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_stock_updated_at 
    BEFORE UPDATE ON items_stock 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fetch_log_device_updated_at 
    BEFORE UPDATE ON fetch_log_device 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Items Stock History Triggers
CREATE TRIGGER trigger_items_stock_history_insert
    AFTER INSERT ON items_stock
    FOR EACH ROW EXECUTE FUNCTION track_items_stock_changes();

CREATE TRIGGER trigger_items_stock_history_update
    AFTER UPDATE ON items_stock
    FOR EACH ROW EXECUTE FUNCTION track_items_stock_changes();

CREATE TRIGGER trigger_items_stock_history_delete
    AFTER DELETE ON items_stock
    FOR EACH ROW EXECUTE FUNCTION track_items_stock_changes();

