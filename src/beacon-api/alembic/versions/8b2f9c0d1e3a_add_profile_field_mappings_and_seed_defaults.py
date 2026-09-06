"""Add profile field mappings and seed defaults

Revision ID: 8b2f9c0d1e3a
Revises: 7a1e8c9d4b2f
Create Date: 2026-08-27 21:15:00.000000

"""
import uuid
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b2f9c0d1e3a'
down_revision: Union[str, None] = '7a1e8c9d4b2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Canonical Hardware Mappings from docs/FIELD_MAPPINGS.md ─────────────────

LOWCOST_TELEMETRY_MAPPINGS = {
    "field1": {"key": "pm2_5_sensor1", "label": "Sensor 1 PM2.5", "unit": "ug/m3"},
    "field2": {"key": "pm10_sensor1", "label": "Sensor 1 PM10", "unit": "ug/m3"},
    "field3": {"key": "pm2_5_sensor2", "label": "Sensor 2 PM2.5", "unit": "ug/m3"},
    "field4": {"key": "pm10_sensor2", "label": "Sensor 2 PM10", "unit": "ug/m3"},
    "field5": {"key": "latitude", "label": "Latitude", "unit": "deg"},
    "field6": {"key": "longitude", "label": "Longitude", "unit": "deg"},
    "field7": {"key": "battery_voltage", "label": "Battery Voltage", "unit": "V"},
    "field8": {"key": "latitude_gps", "label": "GPS Latitude", "source": "field8_csv_0"},
    "field9": {"key": "longitude_gps", "label": "GPS Longitude", "source": "field8_csv_1"},
    "field10": {"key": "altitude", "label": "Altitude", "unit": "m", "source": "field8_csv_2"},
    "field11": {"key": "wind_speed", "label": "Wind Speed", "unit": "m/s", "source": "field8_csv_3"},
    "field12": {"key": "satellites", "label": "Satellites Tracked", "source": "field8_csv_4"},
    "field13": {"key": "hdop", "label": "HDOP", "source": "field8_csv_5"},
    "field14": {"key": "device_temperature", "label": "Internal Device Temp", "unit": "C", "source": "field8_csv_6"},
    "field15": {"key": "device_humidity", "label": "Internal Device Humidity", "unit": "%", "source": "field8_csv_7"},
    "field16": {"key": "temperature", "label": "Ambient Temperature", "unit": "C", "source": "field8_csv_8"},
    "field17": {"key": "humidity", "label": "Ambient Humidity", "unit": "%", "source": "field8_csv_9"},
    "field18": {"key": "vapor_pressure", "label": "Vapor Pressure", "unit": "hPa", "source": "field8_csv_10"},
}

LOWCOST_CONFIG_MAPPINGS = {
    "config1": {"key": "reporting_interval", "label": "Reporting Interval", "type": "int", "unit": "s", "default": 120},
    "config2": {"key": "sample_rate", "label": "Sensor Sample Rate", "type": "int", "unit": "s", "default": 10},
    "config3": {"key": "sleep_mode", "label": "Low-Power Sleep Enabled", "type": "bool", "default": False},
}

LOWCOST_METADATA_MAPPINGS = {
    "metadata1": {"key": "pcb_version", "label": "PCB Hardware Version"},
    "metadata2": {"key": "sensor1_serial_number", "label": "Primary PM Sensor Serial"},
    "metadata3": {"key": "sensor2_serial_number", "label": "Secondary PM Sensor Serial"},
    "metadata4": {"key": "sim_iccid", "label": "Cellular SIM ICCID"},
}

LOWCOST_GAS_TELEMETRY_MAPPINGS = {
    "field1": {"key": "pm2_5", "label": "PM2.5", "unit": "ug/m3"},
    "field2": {"key": "tvoc", "label": "Total VOC", "unit": "ppb"},
    "field3": {"key": "hcho", "label": "Formaldehyde", "unit": "ppm"},
    "field4": {"key": "co2", "label": "Carbon Dioxide", "unit": "ppm"},
    "field5": {"key": "intake_temperature", "label": "Intake Temperature", "unit": "C"},
    "field6": {"key": "intake_humidity", "label": "Intake Humidity", "unit": "%"},
    "field7": {"key": "battery_voltage", "label": "Battery Voltage", "unit": "V"},
    "field8": {"key": "latitude", "label": "GPS Latitude", "source": "field8_csv_0"},
    "field9": {"key": "longitude", "label": "GPS Longitude", "source": "field8_csv_1"},
    "field10": {"key": "altitude", "label": "Altitude", "unit": "m", "source": "field8_csv_2"},
    "field11": {"key": "wind_speed", "label": "Wind Speed", "unit": "m/s", "source": "field8_csv_3"},
    "field14": {"key": "device_temperature", "label": "Internal Device Temp", "unit": "C", "source": "field8_csv_6"},
    "field15": {"key": "device_humidity", "label": "Internal Device Humidity", "unit": "%", "source": "field8_csv_7"},
    "field16": {"key": "temperature", "label": "Ambient Temperature", "unit": "C", "source": "field8_csv_8"},
    "field17": {"key": "humidity", "label": "Ambient Humidity", "unit": "%", "source": "field8_csv_9"},
}

BAM_TELEMETRY_MAPPINGS = {
    "field1": {"key": "timestamp_epoch", "label": "BAM Timestamp"},
    "field2": {"key": "realtime_conc", "label": "Real-time PM Conc (ConcRT)", "unit": "ug/m3"},
    "field3": {"key": "pm2_5", "label": "Hourly PM Conc (ConcHR)", "unit": "ug/m3"},
    "field4": {"key": "short_time_conc", "label": "Short-time PM Conc (ConcS)", "unit": "ug/m3"},
    "field5": {"key": "air_flow", "label": "Air Flow Rate", "unit": "LPM"},
    "field6": {"key": "device_status", "label": "BAM Status Code"},
    "field7": {"key": "battery_voltage", "label": "Logger Battery", "unit": "V"},
    "field8": {"key": "timestamp_ext", "label": "Diagnostic Timestamp", "source": "field8_csv_0"},
    "field9": {"key": "realtime_conc_diag", "label": "ConcRT Diagnostic", "unit": "ug/m3", "source": "field8_csv_1"},
    "field10": {"key": "hourly_conc_diag", "label": "ConcHR Diagnostic", "unit": "ug/m3", "source": "field8_csv_2"},
    "field11": {"key": "short_time_conc_diag", "label": "ConcS Diagnostic", "unit": "ug/m3", "source": "field8_csv_3"},
    "field12": {"key": "air_flow_diag", "label": "Airflow Diagnostic", "unit": "LPM", "source": "field8_csv_4"},
    "field13": {"key": "wind_speed", "label": "Wind Speed", "unit": "m/s", "source": "field8_csv_5"},
    "field14": {"key": "wind_direction", "label": "Wind Direction", "unit": "deg", "source": "field8_csv_6"},
    "field15": {"key": "temperature", "label": "Ambient Temperature", "unit": "C", "source": "field8_csv_7"},
    "field16": {"key": "humidity", "label": "Ambient Humidity", "unit": "%", "source": "field8_csv_8"},
    "field17": {"key": "barometric_pressure", "label": "Barometric Pressure", "unit": "hPa", "source": "field8_csv_9"},
    "field18": {"key": "filter_temperature", "label": "Filter Temperature", "unit": "C", "source": "field8_csv_10"},
    "field19": {"key": "filter_humidity", "label": "Filter Humidity", "unit": "%", "source": "field8_csv_11"},
    "field20": {"key": "device_status_ext", "label": "Extended Status Code", "source": "field8_csv_12"},
}

BAM_METADATA_MAPPINGS = {
    "metadata1": {"key": "bam_serial_number", "label": "BAM Unit Serial Number"},
    "metadata2": {"key": "tape_lot_number", "label": "Filter Tape Lot Number"},
}


def upgrade() -> None:
    # ── 1. Add Dynamic Mapping Columns to device_profiles ─────────────────
    op.add_column(
        'device_profiles',
        sa.Column('telemetry_mappings', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )
    op.add_column(
        'device_profiles',
        sa.Column('config_mappings', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )
    op.add_column(
        'device_profiles',
        sa.Column('metadata_mappings', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False)
    )

    # ── 2. Seed / Update Canonical Hardware Profiles ──────────────────────
    device_profiles_table = sa.table(
        'device_profiles',
        sa.Column('id', sa.UUID()),
        sa.Column('name', sa.String()),
        sa.Column('category', sa.String()),
        sa.Column('description', sa.String()),
        sa.Column('vendor', sa.String()),
        sa.Column('firmware_compatibility', sa.String()),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('telemetry_mappings', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('config_mappings', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('metadata_mappings', postgresql.JSONB(astext_type=sa.Text())),
    )

    # Insert standard canonical profiles
    op.bulk_insert(
        device_profiles_table,
        [
            {
                "id": uuid.uuid4(),
                "name": "lowcost",
                "category": "air_quality",
                "description": "Standard AirQo Dual Optical PM2.5/PM10 Monitor with GPS and Solar/Battery",
                "vendor": "AirQo",
                "firmware_compatibility": "v2.x",
                "metadata": {"is_default_lowcost": True},
                "telemetry_mappings": LOWCOST_TELEMETRY_MAPPINGS,
                "config_mappings": LOWCOST_CONFIG_MAPPINGS,
                "metadata_mappings": LOWCOST_METADATA_MAPPINGS,
            },
            {
                "id": uuid.uuid4(),
                "name": "lowcost_gas",
                "category": "air_quality_gas",
                "description": "AirQo Low-Cost Gas Pollutant Monitor (TVOC, HCHO, CO2)",
                "vendor": "AirQo",
                "firmware_compatibility": "v2.x",
                "metadata": {},
                "telemetry_mappings": LOWCOST_GAS_TELEMETRY_MAPPINGS,
                "config_mappings": LOWCOST_CONFIG_MAPPINGS,
                "metadata_mappings": {"metadata1": {"key": "gas_sensor_type", "label": "Gas Sensor Module"}},
            },
            {
                "id": uuid.uuid4(),
                "name": "bam",
                "category": "reference_monitor",
                "description": "Beta Attenuation Monitor (BAM-1020) Reference Station",
                "vendor": "Met One Instruments",
                "firmware_compatibility": None,
                "metadata": {},
                "telemetry_mappings": BAM_TELEMETRY_MAPPINGS,
                "config_mappings": {},
                "metadata_mappings": BAM_METADATA_MAPPINGS,
            },
        ]
    )

    # Clean up any double-encoded JSON string values if previously inserted as text
    op.execute("""
        UPDATE device_profiles
        SET
            metadata = CASE WHEN jsonb_typeof(metadata) = 'string' THEN (metadata #>> '{}')::jsonb ELSE metadata END,
            telemetry_mappings = CASE WHEN jsonb_typeof(telemetry_mappings) = 'string' THEN (telemetry_mappings #>> '{}')::jsonb ELSE telemetry_mappings END,
            config_mappings = CASE WHEN jsonb_typeof(config_mappings) = 'string' THEN (config_mappings #>> '{}')::jsonb ELSE config_mappings END,
            metadata_mappings = CASE WHEN jsonb_typeof(metadata_mappings) = 'string' THEN (metadata_mappings #>> '{}')::jsonb ELSE metadata_mappings END
        WHERE name IN ('lowcost', 'lowcost_gas', 'bam');
    """)


def downgrade() -> None:
    # Delete seeded profiles
    op.execute("DELETE FROM device_profiles WHERE name IN ('lowcost', 'lowcost_gas', 'bam')")

    # Drop mapping columns
    op.drop_column('device_profiles', 'metadata_mappings')
    op.drop_column('device_profiles', 'config_mappings')
    op.drop_column('device_profiles', 'telemetry_mappings')
