import math
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime


class FeatureExtractor:
    """
    Extracts statistical, temporal, and relational features from raw or windowed telemetry.
    Operates agnostically on arbitrary numerical metric streams.
    """

    @staticmethod
    def calculate_cross_sensor_agreement(
        series_a: List[float], series_b: List[float]
    ) -> Dict[str, float]:
        """
        Calculates Pearson correlation coefficient, Mean Absolute Error (MAE),
        and relative divergence ratio between two collocated or redundant sensors.
        """
        # Filter valid pairs
        pairs = [(a, b) for a, b in zip(series_a, series_b) if a is not None and b is not None and not math.isnan(a) and not math.isnan(b)]
        if len(pairs) < 3:
            return {
                "correlation": 1.0,
                "mean_absolute_error": 0.0,
                "divergence_ratio": 0.0,
                "valid_pairs": len(pairs),
            }

        arr_a = np.array([p[0] for p in pairs], dtype=float)
        arr_b = np.array([p[1] for p in pairs], dtype=float)

        std_a = np.std(arr_a)
        std_b = np.std(arr_b)

        if std_a == 0 or std_b == 0:
            # Constant values: if both are identical constant, corr is 1, else 0
            correlation = 1.0 if np.allclose(arr_a, arr_b) else 0.0
        else:
            corr_matrix = np.corrcoef(arr_a, arr_b)
            correlation = float(corr_matrix[0, 1]) if not np.isnan(corr_matrix[0, 1]) else 0.0

        mae = float(np.mean(np.abs(arr_a - arr_b)))
        mean_combined = max(1.0, float(np.mean((arr_a + arr_b) / 2.0)))
        divergence_ratio = mae / mean_combined

        return {
            "correlation": round(correlation, 4),
            "mean_absolute_error": round(mae, 4),
            "divergence_ratio": round(divergence_ratio, 4),
            "valid_pairs": len(pairs),
        }

    @staticmethod
    def calculate_discharge_gradient(
        values: List[float], timestamps: List[float]
    ) -> float:
        """
        Calculates rate of change (e.g. Volts / hour or Degrees / hour) over time via linear regression.
        timestamps should be in epoch seconds.
        """
        if len(values) < 2 or len(timestamps) < 2 or len(values) != len(timestamps):
            return 0.0

        arr_y = np.array(values, dtype=float)
        arr_x = np.array(timestamps, dtype=float)

        # Normalize x to hours relative to start
        x_hours = (arr_x - arr_x[0]) / 3600.0
        if x_hours[-1] == 0:
            return 0.0

        slope, _ = np.polyfit(x_hours, arr_y, 1)
        return round(float(slope), 4)

    @staticmethod
    def calculate_steepest_discharge_gradient(
        values: List[float], timestamps: List[float], window_size: int = 4
    ) -> float:
        """Finds the steepest downward slope over sliding windows."""
        if len(values) < 3 or len(timestamps) < 3:
            return 0.0
        steepest = 0.0
        arr_y = np.array(values, dtype=float)
        arr_x = (np.array(timestamps, dtype=float) - timestamps[0]) / 3600.0
        for i in range(len(values) - window_size + 1):
            win_y = arr_y[i : i + window_size]
            win_x = arr_x[i : i + window_size]
            if win_x[-1] > win_x[0]:
                slope, _ = np.polyfit(win_x - win_x[0], win_y, 1)
                if slope < steepest:
                    steepest = float(slope)
        return round(steepest, 4)

    @staticmethod
    def calculate_missing_rate(
        actual_records: int, expected_records: int
    ) -> float:
        """Calculates ratio of missing data (0.0 = none missing, 1.0 = completely missing)."""
        if expected_records <= 0:
            return 0.0
        missing = max(0, expected_records - actual_records)
        return round(min(1.0, missing / float(expected_records)), 4)

    @staticmethod
    def calculate_variance_and_spikes(
        series: List[float], std_multiplier: float = 3.0
    ) -> Dict[str, float]:
        """Calculates basic statistics and counts anomalous sudden spikes."""
        valid_vals = [v for v in series if v is not None and not math.isnan(v)]
        if not valid_vals:
            return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0, "spike_count": 0}

        arr = np.array(valid_vals, dtype=float)
        mean_val = float(np.mean(arr))
        std_val = float(np.std(arr))
        min_val = float(np.min(arr))
        max_val = float(np.max(arr))

        spike_count = 0
        if std_val > 0:
            spikes = np.abs(arr - mean_val) > (std_multiplier * std_val)
            spike_count = int(np.sum(spikes))

        return {
            "mean": round(mean_val, 4),
            "std": round(std_val, 4),
            "min": round(min_val, 4),
            "max": round(max_val, 4),
            "spike_count": spike_count,
        }

    @staticmethod
    def calculate_range_violations(
        series: List[float], expected_min: Optional[float], expected_max: Optional[float]
    ) -> Dict[str, Any]:
        """Counts values strictly outside expected operating bounds."""
        valid_vals = [v for v in series if v is not None and not math.isnan(v)]
        if not valid_vals:
            return {"out_of_bounds_count": 0, "violation_rate": 0.0}

        violations = 0
        for v in valid_vals:
            if expected_min is not None and v < expected_min:
                violations += 1
            elif expected_max is not None and v > expected_max:
                violations += 1

        return {
            "out_of_bounds_count": violations,
            "violation_rate": round(violations / len(valid_vals), 4),
        }

    @classmethod
    def extract_all_features(
        cls,
        records: List[Dict[str, Any]],
        expected_frequency_minutes: int = 2,
    ) -> Dict[str, Any]:
        """
        Parses arbitrary telemetry record dictionaries and extracts a comprehensive feature map.
        Supports both raw AirQo device fields and generic metric keys.
        """
        if not records:
            return {
                "record_count": 0,
                "missing_rate": 1.0,
            }

        # Sort records by timestamp if available
        def get_ts(r: Dict[str, Any]) -> float:
            ts = r.get("created_at_ts") or r.get("datetime") or r.get("timestamp") or r.get("time")
            if isinstance(ts, (int, float)):
                return float(ts)
            if isinstance(ts, datetime):
                return ts.timestamp()
            if isinstance(ts, str):
                try:
                    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
                except Exception:
                    pass
            return 0.0

        sorted_records = sorted(records, key=get_ts)
        timestamps = [get_ts(r) for r in sorted_records]

        # Collect time-series per key with source timestamp
        series_by_key: Dict[str, List[Tuple[float, float]]] = {}
        for r in sorted_records:
            r_ts = get_ts(r)
            for k, v in r.items():
                if k in ("created_at_ts", "datetime", "timestamp", "time", "device_id", "channel_id", "id"):
                    continue
                if isinstance(v, (int, float)) and not math.isnan(v):
                    series_by_key.setdefault(k, []).append((float(v), r_ts))

        # Calculate time duration
        first_ts = timestamps[0] if timestamps else 0
        last_ts = timestamps[-1] if timestamps else 0
        duration_minutes = max(1.0, (last_ts - first_ts) / 60.0) if (last_ts > first_ts) else 60.0
        expected_records = max(1, int(duration_minutes / expected_frequency_minutes) + 1)
        actual_records = len(sorted_records)
        missing_rate = cls.calculate_missing_rate(actual_records, expected_records)

        feature_map: Dict[str, Any] = {
            "record_count": actual_records,
            "expected_records": expected_records,
            "duration_hours": round(duration_minutes / 60.0, 2),
            "missing_rate": missing_rate,
            "metrics": {},
        }

        for key, pairs in series_by_key.items():
            vals = [p[0] for p in pairs]
            ts_list = [p[1] for p in pairs]
            stats = cls.calculate_variance_and_spikes(vals)
            gradient = cls.calculate_discharge_gradient(vals, ts_list)
            steepest_discharge = cls.calculate_steepest_discharge_gradient(vals, ts_list)
            feature_map["metrics"][key] = {
                **stats,
                "gradient_per_hour": gradient,
                "discharge_gradient_per_hour": steepest_discharge,
                "count": len(vals),
            }

        # Check for Dual PM sensors (pm2_5_sensor1 & pm2_5_sensor2 or field1 & field3)
        # Build PM pairs only from records containing both sensor values at the same timestamp
        pm1_keys = ("pm2_5_sensor1", "pm2_5_sensor_1", "pm2_5", "field1")
        pm2_keys = ("pm2_5_sensor2", "pm2_5_sensor_2", "field3")
        pm1_paired: List[float] = []
        pm2_paired: List[float] = []

        for r in sorted_records:
            v1 = next((float(r[k]) for k in pm1_keys if k in r and isinstance(r[k], (int, float)) and not math.isnan(r[k])), None)
            v2 = next((float(r[k]) for k in pm2_keys if k in r and isinstance(r[k], (int, float)) and not math.isnan(r[k])), None)
            if v1 is not None and v2 is not None:
                pm1_paired.append(v1)
                pm2_paired.append(v2)

        if pm1_paired and pm2_paired:
            feature_map["pm_sensor_agreement"] = cls.calculate_cross_sensor_agreement(
                pm1_paired, pm2_paired
            )

        return feature_map
