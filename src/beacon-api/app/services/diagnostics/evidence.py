from dataclasses import dataclass
from typing import List, Dict, Any, Optional


@dataclass
class EvidenceFact:
    code: str
    component_name: str
    description: str
    confidence: float # 0.0 to 1.0
    value: Any

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "component_name": self.component_name,
            "description": self.description,
            "confidence": round(self.confidence, 4),
            "value": self.value,
        }


class EvidenceEngine:
    """
    Evaluates statistical features and operational context to produce normalized,
    discrete Evidence Facts with confidence ratings.
    """

    def evaluate(
        self,
        features: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> List[EvidenceFact]:
        context = context or {}
        evidences: List[EvidenceFact] = []
        metrics = features.get("metrics", {})

        # =========================================================================
        # 1. BATTERY & POWER EVALUATION
        # =========================================================================
        batt_stats = metrics.get("battery_voltage") or metrics.get("battery_v") or metrics.get("field7") or {}
        if batt_stats:
            gradient = batt_stats.get("discharge_gradient_per_hour") or batt_stats.get("gradient_per_hour", 0.0)
            min_v = batt_stats.get("min", 0.0)
            mean_v = batt_stats.get("mean", 0.0)
            max_v = batt_stats.get("max", 0.0)

            # Rapid nighttime discharge gradient
            if gradient < -0.20 or (min_v < 11.0 and max_v >= 13.0):
                effective_rate = gradient if gradient < -0.20 else -0.38
                severity_conf = min(1.0, abs(effective_rate) / 0.40)
                evidences.append(
                    EvidenceFact(
                        code="EVID_BATTERY_RAPID_NIGHT_DISCHARGE",
                        component_name="battery",
                        description=f"Battery voltage dropping unusually fast at {abs(effective_rate):.2f} V/hr",
                        confidence=severity_conf,
                        value=effective_rate,
                    )
                )

            # Critically low battery voltage
            if min_v > 0 and min_v < 11.2:
                evidences.append(
                    EvidenceFact(
                        code="EVID_BATTERY_VOLTAGE_CRITICAL_LOW",
                        component_name="battery",
                        description=f"Battery voltage dropped below critical threshold to {min_v:.2f}V",
                        confidence=1.0 if min_v < 10.8 else 0.85,
                        value=min_v,
                    )
                )
            elif mean_v >= 12.6 and min_v >= 11.8:
                evidences.append(
                    EvidenceFact(
                        code="EVID_BATTERY_VOLTAGE_HEALTHY",
                        component_name="battery",
                        description=f"Battery maintained stable voltage (mean {mean_v:.2f}V)",
                        confidence=0.95,
                        value=mean_v,
                    )
                )

        # =========================================================================
        # 2. SOLAR HARVESTING EVALUATION
        # =========================================================================
        solar_v_stats = metrics.get("solar_voltage") or metrics.get("solar_v") or metrics.get("field8") or {}
        solar_i_stats = metrics.get("solar_current") or metrics.get("solar_i") or metrics.get("field9") or {}
        cloud_cover = context.get("cloud_cover_percentage", 0.0)
        is_raining = context.get("is_raining", False)

        if solar_v_stats:
            solar_v_mean = solar_v_stats.get("mean", 0.0)
            solar_i_mean = solar_i_stats.get("mean", 0.0)

            # If daytime and weather is clear, check if solar is generating normally
            if not is_raining and cloud_cover < 40.0:
                if solar_v_mean > 14.0 and (solar_i_mean > 0.3 or "solar_current" not in metrics):
                    evidences.append(
                        EvidenceFact(
                            code="EVID_SOLAR_INPUT_NORMAL",
                            component_name="solar_panel",
                            description="Solar generation is healthy and consistent with ambient irradiance",
                            confidence=0.92,
                            value=solar_v_mean,
                        )
                    )
                elif solar_v_mean > 14.0 and solar_i_mean < 0.05 and "solar_current" in metrics:
                    evidences.append(
                        EvidenceFact(
                            code="EVID_SOLAR_VOLTAGE_HIGH_CURRENT_ZERO",
                            component_name="solar_panel",
                            description="Solar panel open-circuit voltage present but zero current flowing (possible fuse/wiring fault)",
                            confidence=0.88,
                            value={"v": solar_v_mean, "i": solar_i_mean},
                        )
                    )
                elif solar_v_mean < 8.0:
                    evidences.append(
                        EvidenceFact(
                            code="EVID_SOLAR_UNDERPERFORMING_CLEAR_SKY",
                            component_name="solar_panel",
                            description=f"Solar output severely degraded ({solar_v_mean:.1f}V) despite clear skies",
                            confidence=0.85,
                            value=solar_v_mean,
                        )
                    )
            elif is_raining or cloud_cover >= 70.0:
                evidences.append(
                    EvidenceFact(
                        code="EVID_POOR_WEATHER_CONDITIONS",
                        component_name="environment",
                        description=f"Adverse weather detected: cloud cover {cloud_cover}%",
                        confidence=0.90,
                        value=cloud_cover,
                    )
                )

        # =========================================================================
        # 3. DUAL PM / SENSOR AGREEMENT & STUCK SENSORS
        # =========================================================================
        agreement = features.get("pm_sensor_agreement")
        if agreement:
            corr = agreement.get("correlation", 1.0)
            div_ratio = agreement.get("divergence_ratio", 0.0)
            mae = agreement.get("mean_absolute_error", 0.0)

            if corr >= 0.85 and div_ratio < 0.20:
                evidences.append(
                    EvidenceFact(
                        code="EVID_PM_SENSORS_IN_AGREEMENT",
                        component_name="pm_sensors",
                        description=f"Primary and secondary PM sensors are highly correlated (r={corr:.2f}, MAE={mae:.2f})",
                        confidence=0.95,
                        value=corr,
                    )
                )
            elif corr < 0.65 or div_ratio > 0.35:
                evidences.append(
                    EvidenceFact(
                        code="EVID_PM_SENSORS_DIVERGING",
                        component_name="pm_sensors",
                        description=f"PM sensors show significant divergence (r={corr:.2f}, MAE={mae:.2f} ug/m3)",
                        confidence=min(1.0, (1.0 - max(0.0, corr)) + (div_ratio * 0.5)),
                        value={"correlation": corr, "divergence_ratio": div_ratio, "mae": mae},
                    )
                )

        # Check for individual stuck PM / temperature sensors (std = 0, count > 10)
        for key in ("pm2_5", "pm2_5_sensor1", "pm2_5_sensor_1", "pm2_5_sensor2", "pm2_5_sensor_2", "temperature", "humidity", "field1", "field3", "field5"):
            s_stats = metrics.get(key)
            if s_stats and s_stats.get("count", 0) >= 10:
                std_val = s_stats.get("std", 0.0)
                mean_val = s_stats.get("mean", 0.0)
                if std_val == 0.0 and mean_val != 0.0:
                    evidences.append(
                        EvidenceFact(
                            code=f"EVID_{key.upper()}_STUCK_CONSTANT_VALUE",
                            component_name="sensors",
                            description=f"Sensor {key} is frozen at constant value {mean_val:.2f} (std = 0)",
                            confidence=0.95,
                            value=mean_val,
                        )
                    )

        # =========================================================================
        # 4. COLD CHAIN & REFRIGERATION EVALUATION
        # =========================================================================
        freezer_temp = metrics.get("refrigerator_temp") or metrics.get("chamber_temp") or {}
        compressor_i = metrics.get("compressor_current") or {}
        door_switch = metrics.get("door_open") or {}

        if freezer_temp:
            f_mean = freezer_temp.get("mean", 0.0)
            f_max = freezer_temp.get("max", 0.0)
            target_max = context.get("target_max_temperature", -15.0) # e.g. -15°C for vaccines

            if f_max > target_max:
                evidences.append(
                    EvidenceFact(
                        code="EVID_COLD_CHAIN_TEMPERATURE_BREACH",
                        component_name="cooling",
                        description=f"Refrigeration temp breached safe limit ({f_max:.1f}C > {target_max:.1f}C)",
                        confidence=min(1.0, 0.80 + max(0.0, f_max - target_max) * 0.05),
                        value=f_max,
                    )
                )

            if compressor_i:
                c_mean = compressor_i.get("mean", 0.0)
                if f_mean > target_max and c_mean < 0.10:
                    evidences.append(
                        EvidenceFact(
                            code="EVID_COMPRESSOR_NOT_RUNNING_DURING_WARM_TEMP",
                            component_name="cooling",
                            description="Chamber temperature above setpoint but compressor draw is 0.0A",
                            confidence=0.96,
                            value={"temp": f_mean, "current": c_mean},
                        )
                    )

        # =========================================================================
        # 5. DATA AVAILABILITY & CONNECTIVITY
        # =========================================================================
        missing_rate = features.get("missing_rate", 0.0)
        if missing_rate > 0.40:
            evidences.append(
                EvidenceFact(
                    code="EVID_HIGH_TELEMETRY_PACKET_LOSS",
                    component_name="connectivity",
                    description=f"High data gap rate ({missing_rate * 100:.1f}% missing transmissions)",
                    confidence=min(1.0, missing_rate),
                    value=missing_rate,
                )
            )

        return evidences
