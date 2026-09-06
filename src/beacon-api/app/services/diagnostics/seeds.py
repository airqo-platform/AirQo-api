from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.diagnostics import DiagnosticTemplate, SymptomDefinition, CauseDefinition, DiagnosticHypothesisRule
from app.models.device_schema import DeviceProfile, ComponentDefinition, MetricDefinition, ComponentRelationship
from app.models.vendor import Vendor


def get_default_candidate_causes() -> List[Dict[str, Any]]:
    """Returns candidate root causes with evidential weighting rules for in-memory and seeded evaluation."""
    return [
        # =========================================================================
        # 1. BATTERY & POWER SUBSYSTEM
        # =========================================================================
        {
            "code": "CAUSE_BATTERY_DEGRADATION",
            "title": "Battery Capacity Loss / Internal Cell Degradation",
            "category": "HARDWARE_FAILURE",
            "recommended_action": "Schedule LiFePO4 battery pack replacement. Solar harvesting is healthy.",
            "rules": [
                {"evidence_code": "EVID_BATTERY_RAPID_NIGHT_DISCHARGE", "weight": 3.5, "is_mandatory": True},
                {"evidence_code": "EVID_SOLAR_INPUT_NORMAL", "weight": 2.0, "is_mandatory": False},
                {"evidence_code": "EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY", "weight": -3.5, "is_mandatory": False},
                {"evidence_code": "EVID_POOR_WEATHER_CONDITIONS", "weight": -3.0, "is_mandatory": False},
            ],
        },
        {
            "code": "CAUSE_SOLAR_PANEL_SOILING_OR_DAMAGE",
            "title": "Solar Panel Dust Soiling or Physical Obstruction",
            "category": "MAINTENANCE_REQUIRED",
            "recommended_action": "Clean solar panel glass and check panel tilt angle for optimal irradiance.",
            "rules": [
                {"evidence_code": "EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY", "weight": 4.0, "is_mandatory": True},
                {"evidence_code": "EVID_SOLAR_INPUT_NORMAL", "weight": -5.0, "is_mandatory": False},
                {"evidence_code": "EVID_POOR_WEATHER_CONDITIONS", "weight": -2.0, "is_mandatory": False},
            ],
        },
        {
            "code": "CAUSE_SOLAR_WIRING_OR_FUSE_OPEN",
            "title": "Solar Harvesting Open Circuit / Blown Fuse",
            "category": "ELECTRICAL_FAULT",
            "recommended_action": "Inspect solar charge controller wiring, inline fuse, and terminal block continuity.",
            "rules": [
                {"evidence_code": "EVID_SOLAR_VOLTAGE_HIGH_CURRENT_ZERO", "weight": 5.0, "is_mandatory": True},
            ],
        },
        # =========================================================================
        # 2. SENSOR SUBSYSTEM (DUAL PM)
        # =========================================================================
        {
            "code": "CAUSE_OPTICAL_CHAMBER_CONTAMINATION",
            "title": "Optical Chamber Contamination / Sensor Drift",
            "category": "HARDWARE_FAILURE",
            "recommended_action": "Perform zero-calibration check; clean optical chamber with compressed air or replace sensor module.",
            "rules": [
                {"evidence_code": "EVID_PM_SENSORS_DIVERGING", "weight": 4.5, "is_mandatory": True},
                {"evidence_code": "EVID_PM_SENSORS_IN_AGREEMENT", "weight": -5.0, "is_mandatory": False},
            ],
        },
        {
            "code": "CAUSE_SENSOR_COMMUNICATION_FREEZE",
            "title": "Sensor UART Communication Lockup / I2C Glitch",
            "category": "FIRMWARE_OR_BUS_FAULT",
            "recommended_action": "Send remote reboot command or verify 3.3V/5V supply rail to sensor bus.",
            "rules": [
                {"evidence_code": "EVID_PM2_5_STUCK_CONSTANT_VALUE", "weight": 4.5, "is_mandatory": False},
                {"evidence_code": "EVID_TEMPERATURE_STUCK_CONSTANT_VALUE", "weight": 4.5, "is_mandatory": False},
            ],
        },
        # =========================================================================
        # 3. COLD CHAIN & REFRIGERATION
        # =========================================================================
        {
            "code": "CAUSE_COMPRESSOR_RELAY_OR_POWER_FAILURE",
            "title": "Compressor Motor / Relay Failure",
            "category": "CRITICAL_COOLING_FAILURE",
            "recommended_action": "Check solid-state relay and main 220V/12V compressor power immediately to preserve vaccines.",
            "rules": [
                {"evidence_code": "EVID_COMPRESSOR_NOT_RUNNING_DURING_WARM_TEMP", "weight": 5.0, "is_mandatory": True},
                {"evidence_code": "EVID_COLD_CHAIN_TEMPERATURE_BREACH", "weight": 2.5, "is_mandatory": False},
            ],
        },
    ]


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


def seed_default_templates(db: Session) -> Dict[str, Any]:
    """Seeds default Vendors, DeviceProfiles, and DiagnosticTemplates into PostgreSQL if not already present."""
    
    # ── 0. Seed Default Vendors ──────────────────────────────────────────
    airqo_vendor = db.query(Vendor).filter(Vendor.name == "AirQo").first()
    if not airqo_vendor:
        airqo_vendor = Vendor(
            name="AirQo",
            description="AirQo Air Quality Hardware and Sensor Platforms",
        )
        db.add(airqo_vendor)
        db.flush()

    met_one_vendor = db.query(Vendor).filter(Vendor.name == "Met One Instruments").first()
    if not met_one_vendor:
        met_one_vendor = Vendor(
            name="Met One Instruments",
            description="Met One Instruments Regulatory Reference Monitors (BAM-1020)",
        )
        db.add(met_one_vendor)
        db.flush()

    coldchain_vendor = db.query(Vendor).filter(Vendor.name == "Generic ColdChain").first()
    if not coldchain_vendor:
        coldchain_vendor = Vendor(
            name="Generic ColdChain",
            description="Cold Chain Ultra-low Refrigeration and Pharmaceutical Monitoring",
        )
        db.add(coldchain_vendor)
        db.flush()

    # ── 1. AirQo Low-Cost Dual PM Profile (`lowcost`) ────────────────────
    lowcost_profile = db.query(DeviceProfile).filter(DeviceProfile.name.in_(["lowcost", "AirQo-v5-DualPM"])).first()
    if not lowcost_profile:
        lowcost_profile = DeviceProfile(
            name="lowcost",
            category="air_quality",
            description="Standard AirQo Dual Optical PM2.5/PM10 Monitor with GPS and Solar/Battery",
            vendor_id=airqo_vendor.id,
            telemetry_mappings=LOWCOST_TELEMETRY_MAPPINGS,
            config_mappings=LOWCOST_CONFIG_MAPPINGS,
            metadata_mappings=LOWCOST_METADATA_MAPPINGS,
        )
        db.add(lowcost_profile)
        db.flush()

        c_power = ComponentDefinition(profile_id=lowcost_profile.id, name="power_subsystem", component_type="battery", criticality=0.35)
        c_pm1 = ComponentDefinition(profile_id=lowcost_profile.id, name="pm_sensor_primary", component_type="sensor", criticality=0.35)
        c_pm2 = ComponentDefinition(profile_id=lowcost_profile.id, name="pm_sensor_secondary", component_type="sensor", criticality=0.15)
        c_modem = ComponentDefinition(profile_id=lowcost_profile.id, name="gsm_modem", component_type="connectivity", criticality=0.15)
        db.add_all([c_power, c_pm1, c_pm2, c_modem])
        db.flush()

        m1 = MetricDefinition(component_id=c_power.id, key="battery_voltage", unit="V", expected_min=11.5, expected_max=14.6)
        m2 = MetricDefinition(component_id=c_power.id, key="solar_voltage", unit="V", expected_min=0.0, expected_max=22.0)
        m3 = MetricDefinition(component_id=c_pm1.id, key="pm2_5", unit="ug/m3", expected_min=0.0, expected_max=500.0)
        m4 = MetricDefinition(component_id=c_pm2.id, key="pm2_5_sensor_2", unit="ug/m3", expected_min=0.0, expected_max=500.0)
        db.add_all([m1, m2, m3, m4])
    else:
        if not lowcost_profile.vendor_id:
            lowcost_profile.vendor_id = airqo_vendor.id
        # Update mappings if not yet populated
        if not lowcost_profile.telemetry_mappings:
            lowcost_profile.telemetry_mappings = LOWCOST_TELEMETRY_MAPPINGS
            lowcost_profile.config_mappings = LOWCOST_CONFIG_MAPPINGS
            lowcost_profile.metadata_mappings = LOWCOST_METADATA_MAPPINGS

    # ── 2. Low-Cost Gas Profile (`lowcost_gas`) ───────────────────────────
    gas_profile = db.query(DeviceProfile).filter(DeviceProfile.name == "lowcost_gas").first()
    if not gas_profile:
        gas_profile = DeviceProfile(
            name="lowcost_gas",
            category="air_quality_gas",
            description="AirQo Low-Cost Gas Pollutant Monitor (TVOC, HCHO, CO2)",
            vendor_id=airqo_vendor.id,
            telemetry_mappings=LOWCOST_GAS_TELEMETRY_MAPPINGS,
            config_mappings=LOWCOST_CONFIG_MAPPINGS,
            metadata_mappings={"metadata1": {"key": "gas_sensor_type", "label": "Gas Sensor Module"}},
        )
        db.add(gas_profile)
        db.flush()
    else:
        if not gas_profile.vendor_id:
            gas_profile.vendor_id = airqo_vendor.id

    # ── 3. BAM Reference Monitor Profile (`bam`) ──────────────────────────
    bam_profile = db.query(DeviceProfile).filter(DeviceProfile.name == "bam").first()
    if not bam_profile:
        bam_profile = DeviceProfile(
            name="bam",
            category="reference_monitor",
            description="Beta Attenuation Monitor (BAM-1020) Reference Station",
            vendor_id=met_one_vendor.id,
            telemetry_mappings=BAM_TELEMETRY_MAPPINGS,
            config_mappings={},
            metadata_mappings=BAM_METADATA_MAPPINGS,
        )
        db.add(bam_profile)
        db.flush()
    else:
        if not bam_profile.vendor_id:
            bam_profile.vendor_id = met_one_vendor.id

    # ── 4. Cold Chain Profile (`ColdChain-UltraLow-Monitor`) ───────────────
    cc_profile = db.query(DeviceProfile).filter(DeviceProfile.name == "ColdChain-UltraLow-Monitor").first()
    if not cc_profile:
        cc_profile = DeviceProfile(
            name="ColdChain-UltraLow-Monitor",
            category="cold_chain",
            description="Ultra-low temperature vaccine and pharmaceutical refrigeration monitor.",
            vendor_id=coldchain_vendor.id,
            telemetry_mappings={
                "refrigerator_temp": {"key": "refrigerator_temp", "label": "Chamber Temperature", "unit": "C"},
                "compressor_current": {"key": "compressor_current", "label": "Compressor Current", "unit": "A"},
                "door_open": {"key": "door_open", "label": "Door Open Status"},
            },
            config_mappings={
                "target_temp": {"key": "target_temp", "label": "Target Temperature", "type": "float", "unit": "C", "default": -20.0},
            },
            metadata_mappings={
                "freezer_model": {"key": "freezer_model", "label": "Freezer Model"},
            },
        )
        db.add(cc_profile)
        db.flush()

        c_cooling = ComponentDefinition(profile_id=cc_profile.id, name="cooling_unit", component_type="cooling", criticality=0.60)
        c_temp = ComponentDefinition(profile_id=cc_profile.id, name="temperature_probe", component_type="sensor", criticality=0.40)
        db.add_all([c_cooling, c_temp])
        db.flush()

        m_temp = MetricDefinition(component_id=c_temp.id, key="refrigerator_temp", unit="C", expected_min=-80.0, expected_max=-15.0)
        m_curr = MetricDefinition(component_id=c_cooling.id, key="compressor_current", unit="A", expected_min=0.0, expected_max=15.0)
        db.add_all([m_temp, m_curr])
    else:
        if not cc_profile.vendor_id:
            cc_profile.vendor_id = coldchain_vendor.id

    # ── 5. Seed Diagnostic Templates ──────────────────────────────────────
    for cause_data in get_default_candidate_causes():
        t_name = f"Template for {cause_data['category']}"
        template = db.query(DiagnosticTemplate).filter(DiagnosticTemplate.name == t_name).first()
        if not template:
            template = DiagnosticTemplate(
                name=t_name,
                target_component_type=cause_data["category"].lower(),
                description=f"Standard diagnostic rules for {cause_data['category']}",
            )
            db.add(template)
            db.flush()

        cause = db.query(CauseDefinition).filter(CauseDefinition.code == cause_data["code"]).first()
        if not cause:
            cause = CauseDefinition(
                template_id=template.id,
                code=cause_data["code"],
                title=cause_data["title"],
                category=cause_data["category"],
                recommended_action=cause_data["recommended_action"],
            )
            db.add(cause)
            db.flush()

            for r_data in cause_data["rules"]:
                rule = DiagnosticHypothesisRule(
                    cause_id=cause.id,
                    evidence_code=r_data["evidence_code"],
                    weight=r_data["weight"],
                    is_mandatory=r_data.get("is_mandatory", False),
                )
                db.add(rule)

    db.commit()
    return {"status": "success", "message": "Default IoT profiles, dynamic mappings, and diagnostic templates seeded successfully."}
