-- Beacon Analytics Database Migration
-- Creates tables and relationships for IoT device analytics
-- Updated to accept all values from AirQo API

SET timezone = 'Africa/Kampala';

-- Dimension Tables

CREATE TABLE dim_device (
    device_key SERIAL PRIMARY KEY,
    device_id VARCHAR(100) UNIQUE NOT NULL,
    device_name VARCHAR(100) NOT NULL,
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
    
    -- Only keep the height constraint as it's a logical business rule
    CONSTRAINT chk_device_height CHECK (height IS NULL OR height >= 0)
    -- Removed restrictive constraints for status, category, and network
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
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- PM readings
    s1_pm2_5 FLOAT,
    s1_pm10 FLOAT,
    s2_pm2_5 FLOAT,
    s2_pm10 FLOAT,
    
    -- Environmental
    temperature FLOAT,
    humidity FLOAT,
    wind_speed FLOAT,
    
    -- Device hardware
    device_temperature FLOAT,
    device_humidity FLOAT,
    battery FLOAT,
    altitude FLOAT,
    
    -- GPS data
    latitude FLOAT,
    longitude FLOAT,
    hdop FLOAT,
    satellites INTEGER,
    
    -- Metadata
    frequency VARCHAR(20),
    network VARCHAR(50),
    device_category VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Keep all logical constraints
    CONSTRAINT chk_readings_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 hour'),
    CONSTRAINT chk_readings_pm_values CHECK (
        (s1_pm2_5 IS NULL OR s1_pm2_5 >= 0) AND
        (s1_pm10 IS NULL OR s1_pm10 >= 0) AND
        (s2_pm2_5 IS NULL OR s2_pm2_5 >= 0) AND
        (s2_pm10 IS NULL OR s2_pm10 >= 0)
    ),
    CONSTRAINT chk_readings_humidity CHECK (
        (humidity IS NULL OR (humidity >= 0 AND humidity <= 100)) AND
        (device_humidity IS NULL OR (device_humidity >= 0 AND device_humidity <= 100))
    ),
    CONSTRAINT chk_readings_battery CHECK (battery IS NULL OR (battery >= 0 AND battery <= 100)),
    CONSTRAINT chk_readings_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR 
        (latitude IS NOT NULL AND longitude IS NOT NULL AND
         latitude >= -90 AND latitude <= 90 AND
         longitude >= -180 AND longitude <= 180)
    ),
    CONSTRAINT chk_readings_satellites CHECK (satellites IS NULL OR satellites >= 0),
    CONSTRAINT chk_readings_wind_speed CHECK (wind_speed IS NULL OR wind_speed >= 0),
    
    UNIQUE(device_key, timestamp)
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

-- Indexes (unchanged)

CREATE INDEX idx_dim_device_device_id ON dim_device(device_id);
CREATE INDEX idx_dim_device_status ON dim_device(status);
CREATE INDEX idx_dim_device_active ON dim_device(is_active);
CREATE INDEX idx_dim_device_category ON dim_device(category);
CREATE INDEX idx_dim_device_network ON dim_device(network);

CREATE INDEX idx_dim_location_device_key ON dim_location(device_key);
CREATE INDEX idx_dim_location_active ON dim_location(device_key, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_dim_location_coordinates ON dim_location(latitude, longitude);
CREATE INDEX idx_dim_location_site_id ON dim_location(site_id);

CREATE INDEX idx_fact_device_status_device_key ON fact_device_status(device_key);
CREATE INDEX idx_fact_device_status_timestamp ON fact_device_status(timestamp DESC);
CREATE INDEX idx_fact_device_status_device_timestamp ON fact_device_status(device_key, timestamp DESC);

CREATE INDEX idx_fact_device_readings_device_key ON fact_device_readings(device_key);
CREATE INDEX idx_fact_device_readings_timestamp ON fact_device_readings(timestamp DESC);
CREATE INDEX idx_fact_device_readings_device_timestamp ON fact_device_readings(device_key, timestamp DESC);
CREATE INDEX idx_fact_device_readings_s1_pm2_5 ON fact_device_readings(s1_pm2_5) WHERE s1_pm2_5 IS NOT NULL;
CREATE INDEX idx_fact_device_readings_s2_pm2_5 ON fact_device_readings(s2_pm2_5) WHERE s2_pm2_5 IS NOT NULL;
CREATE INDEX idx_fact_device_readings_category ON fact_device_readings(device_category);

CREATE INDEX idx_fact_health_tips_reading_key ON fact_health_tips(reading_key);
CREATE INDEX idx_fact_health_tips_aqi_category ON fact_health_tips(aqi_category);

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