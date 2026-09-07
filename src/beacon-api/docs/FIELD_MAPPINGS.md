# AirQo Device Field Mappings (Fields 1–20)

This document details how raw ThingSpeak feeds and device data are mapped to database columns (`field1` through `field20`) across AirQo database tables (`sync_raw_device_data`, `sync_hourly_device_data`, `sync_daily_device_data`) and ETL data pipelines.

---

## 1. Overview & Ingestion Mechanism

- **Direct Fields (`field1` – `field7`)**:
  These come directly from the standard fields 1–7 of a ThingSpeak channel.
- **Parsed Metadata Fields (`field8` – `field20`)**:
  ThingSpeak channels transmit an extra comma-separated string in `field8` containing up to 13 sub-values (indices 0 to 12).
  During data ingestion (e.g., in `thingspeak_sync_service.py` and AirQo ETL utilities), the CSV string in `field8` is split and stored into database columns `field8` through `field20`:
  $$\text{Database Column Index} = 8 + \text{CSV Index}$$

---

## 2. Field Mapping Comparison Table

| Database Column | ThingSpeak Source | Low-Cost PM Sensor (Standard) | Low-Cost Gas Sensor | BAM / Reference Device |
| :--- | :--- | :--- | :--- | :--- |
| **`field1`** | Direct Field 1 | **Sensor 1 PM2.5** (`s1_pm2_5`) | PM2.5 (`pm2_5`) | **Date and Time** (`timestamp`) |
| **`field2`** | Direct Field 2 | **Sensor 1 PM10** (`s1_pm10`) | TVOC (`tvoc`) | **Real-time PM Concentration** (`ConcRT` / `realtime_conc`) |
| **`field3`** | Direct Field 3 | **Sensor 2 PM2.5** (`s2_pm2_5`) | HCHO (`hcho`) | **Hourly PM Concentration** (`ConcHR` / `pm2_5`) |
| **`field4`** | Direct Field 4 | **Sensor 2 PM10** (`s2_pm10`) | CO2 (`co2`) | **Short-time PM Concentration** (`ConcS` / `short_time_conc`) |
| **`field5`** | Direct Field 5 | **Latitude** | Intake Temperature (`intaketemperature`) | **Air Flow** (`Flow(LPM)` / `air_flow`) |
| **`field6`** | Direct Field 6 | **Longitude** | Intake Humidity (`intakehumidity`) | **Device Status** (`status` / `DeviceStatus`) |
| **`field7`** | Direct Field 7 | **Battery Voltage** (`battery`) | Battery Voltage (`battery`) | **Logger Battery** (`battery`) |
| **`field8`** | `field8` CSV [0] | **Latitude** (`latitude`) | Latitude (`latitude`) | **Timestamp** (`timestamp_`) |
| **`field9`** | `field8` CSV [1] | **Longitude** (`longitude`) | Longitude (`longitude`) | **Real-time PM Conc** (`realtime_conc` / `ConcRT`) |
| **`field10`** | `field8` CSV [2] | **Altitude** (`altitude`) | Altitude (`altitude`) | **Hourly PM Conc** (`hourly_conc` / `ConcHR`) |
| **`field11`** | `field8` CSV [3] | **Wind Speed / Velocity** (`wind_speed`) | Wind Speed / Velocity (`wind_speed`) | **Short-time PM Conc** (`short_time_conc` / `ConcS`) |
| **`field12`** | `field8` CSV [4] | **Satellites Tracked** (`satellites`) | Satellites Tracked (`satellites`) | **Air Flow** (`air_flow` / `airflow`) |
| **`field13`** | `field8` CSV [5] | **HDOP** (`hdop`) | HDOP (`hdop`) | **Wind Speed** (`wind_speed`) |
| **`field14`** | `field8` CSV [6] | **Internal Device Temp** (`device_temperature`) | Internal Device Temp (`device_temperature`) | **Wind Direction** (`wind_direction`) |
| **`field15`** | `field8` CSV [7] | **Internal Device Humidity** (`device_humidity`) | Internal Device Humidity (`device_humidity`) | **Ambient Temperature** (`temperature`) |
| **`field16`** | `field8` CSV [8] | **External Temperature** (`temperature`) | External Temperature (`temperature`) | **Ambient Humidity** (`humidity`) |
| **`field17`** | `field8` CSV [9] | **External Humidity** (`humidity`) | External Humidity (`humidity`) | **Barometric Pressure** (`barometric_pressure`) |
| **`field18`** | `field8` CSV [10] | **Vapor / Ext Pressure** (`vapor_pressure`) | Vapor / Ext Pressure (`vapor_pressure`) | **Filter Temperature** (`filter_temperature`) |
| **`field19`** | `field8` CSV [11] | *Reserved / Extra* | *Reserved / Extra* | **Filter Humidity** (`filter_humidity`) |
| **`field20`** | `field8` CSV [12] | *Reserved / Extra* | *Reserved / Extra* | **Device Status** (`status`) |

---

## 3. Category Breakdown

### A. Standard Low-Cost PM Monitor (`lowcost`)
Dual-laser optical particle counter hardware providing redundancy for PM2.5 and PM10 measurements along with GPS, power, and atmospheric metrics:
- **`field1`**: Sensor 1 PM2.5 ($\mu g/m^3$)
- **`field2`**: Sensor 1 PM10 ($\mu g/m^3$)
- **`field3`**: Sensor 2 PM2.5 ($\mu g/m^3$)
- **`field4`**: Sensor 2 PM10 ($\mu g/m^3$)
- **`field7`**: Battery Voltage (V)
- **`field8` – `field18`**: GPS coordinates (lat, lon, alt), speed, satellites, HDOP, internal & external temperature/humidity, and atmospheric vapor pressure.

### B. Low-Cost Gas Monitor (`lowcost_gas`)
Specialized low-cost device targeting gaseous pollutants:
- **`field1`**: PM2.5 ($\mu g/m^3$)
- **`field2`**: Total Volatile Organic Compounds (TVOC)
- **`field3`**: Formaldehyde (HCHO)
- **`field4`**: Carbon Dioxide (CO2)
- **`field5` / `field6`**: Intake Temperature & Intake Humidity
- **`field7`**: Battery Voltage (V)
- **`field8` – `field18`**: Location, internal/external atmospheric parameters.

### C. BAM (Beta Attenuation Monitor / Reference Monitor) (`bam`)
Regulatory-grade reference monitor:
- **`field1`**: Primary timestamp
- **`field2`**: Real-time Concentration (`ConcRT` in $\mu g/m^3$)
- **`field3`**: Hourly Concentration (`ConcHR` in $\mu g/m^3$, primary reference PM2.5)
- **`field4`**: Short-time Concentration (`ConcS` in $\mu g/m^3$)
- **`field5`**: Air flow rate (`Flow(LPM)`)
- **`field6`**: Device status code
- **`field7`**: Logger battery voltage
- **`field8` – `field20`**: Complete BAM comma-separated diagnostic and environmental metrics (timestamps, realtime/hourly/short-time concentrations, airflow, wind speed/direction, ambient temperature/humidity, barometric pressure, filter temperature/humidity, status).

---

## 4. Code References in Repository

- **Label Utilities & Mappers**:
  - `src/beacon-api/app/utils/field_mappings.py`
  - `src/beacon-api/app/services/device_service.py`
- **Data Ingestion & Field8 CSV Parsing**:
  - `src/beacon-api/app/services/thingspeak_sync_service.py` (`_parse_feed_record`)
  - `src/beacon-api/app/models/device_data.py` (`SyncRawDeviceData`, `SyncHourlyDeviceData`, `SyncDailyDeviceData`)
- **ETL Configuration**:
  - `src/workflows/airqo_etl_utils/config.py` (`AIRQO_LOW_COST_FIELD_MAPPING`, `AIRQO_BAM_MAPPING_NEW`, `AIRQO_LOW_COST_GAS_FIELD_MAPPING`)
- **Device Registry Definitions**:
  - `src/device-registry/config/definitions/mappings.js`
