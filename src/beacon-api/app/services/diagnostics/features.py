import math
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone

_TIMESTAMP_KEYS = ("created_at_ts", "datetime", "timestamp", "time")
_NON_METRIC_KEYS = set(_TIMESTAMP_KEYS) | {"device_id", "channel_id", "id", "entry_id"}


class FeatureExtractor:
    """
    Extracts statistical, temporal, and relational features from raw or windowed telemetry.
    Operates agnostically on arbitrary numerical metric streams; what the values mean
    comes from the device profile.
    """

    @staticmethod
    def get_record_timestamp(record: Dict[str, Any]) -> Optional[float]:
        """Epoch seconds for a record, or None when it has no usable timestamp."""
        ts = next((record[k] for k in _TIMESTAMP_KEYS if record.get(k) is not None), None)
        if isinstance(ts, (int, float)) and not isinstance(ts, bool):
            return None if math.isnan(ts) or math.isinf(ts) else float(ts)
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                return None
        if isinstance(ts, datetime):
            # Naive values are UTC (the sync stores UTC); never interpret them in the host's zone.
            return (ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)).timestamp()
        return None

    @staticmethod
    def _is_number(value: Any) -> bool:
        return isinstance(value, (int, float)) and not isinstance(value, bool) and not math.isnan(value)

    @staticmethod
    def calculate_cross_sensor_agreement(
        series_a: List[float], series_b: List[float]
    ) -> Dict[str, float]:
        """
        Calculates Pearson correlation coefficient, Mean Absolute Error (MAE),
        and relative divergence ratio between two collocated or redundant sensors.
        """
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
        Calculates rate of change (units / hour) over time via linear regression.
        timestamps should be in epoch seconds.
        """
        if len(values) < 2 or len(timestamps) < 2 or len(values) != len(timestamps):
            return 0.0

        arr_y = np.array(values, dtype=float)
        arr_x = np.array(timestamps, dtype=float)

        x_hours = (arr_x - arr_x[0]) / 3600.0
        if x_hours[-1] == 0:
            return 0.0

        slope, _ = np.polyfit(x_hours, arr_y, 1)
        return round(float(slope), 4)

    @staticmethod
    def calculate_max_rates_per_hour(
        values: List[float],
        timestamps: List[float],
        window_seconds: float = 3600.0,
        min_samples: int = 3,
    ) -> Tuple[float, float]:
        """
        Steepest rise and steepest fall (units / hour, both as positive magnitudes) found in
        consecutive time windows, using a linear fit per window so single noisy samples do not
        dominate. Returns (max_rise, max_fall).
        """
        if len(values) < min_samples or len(values) != len(timestamps):
            return 0.0, 0.0

        start = timestamps[0]
        buckets: Dict[int, List[Tuple[float, float]]] = {}
        for v, ts in zip(values, timestamps):
            buckets.setdefault(int((ts - start) // window_seconds), []).append((ts, v))

        max_rise, max_fall = 0.0, 0.0
        for points in buckets.values():
            if len(points) < min_samples:
                continue
            xs = np.array([p[0] for p in points], dtype=float)
            if xs[-1] <= xs[0]:
                continue
            ys = np.array([p[1] for p in points], dtype=float)
            slope, _ = np.polyfit((xs - xs[0]) / 3600.0, ys, 1)
            if slope > max_rise:
                max_rise = float(slope)
            elif -slope > max_fall:
                max_fall = float(-slope)
        return round(max_rise, 4), round(max_fall, 4)

    @classmethod
    def calculate_max_rate_per_hour(
        cls,
        values: List[float],
        timestamps: List[float],
        window_seconds: float = 3600.0,
        min_samples: int = 3,
    ) -> Tuple[float, float]:
        """Largest absolute rate of change and its sign: (max_abs_rate, signed_rate)."""
        rise, fall = cls.calculate_max_rates_per_hour(values, timestamps, window_seconds, min_samples)
        return (rise, rise) if rise >= fall else (fall, -fall)

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
        """Counts values strictly below / above the expected operating bounds."""
        valid_vals = [v for v in series if v is not None and not math.isnan(v)]
        if not valid_vals:
            return {"below_count": 0, "above_count": 0, "below_rate": 0.0, "above_rate": 0.0}

        below = sum(1 for v in valid_vals if expected_min is not None and v < expected_min)
        above = sum(1 for v in valid_vals if expected_max is not None and v > expected_max)
        return {
            "below_count": below,
            "above_count": above,
            "below_rate": round(below / len(valid_vals), 4),
            "above_rate": round(above / len(valid_vals), 4),
        }

    @classmethod
    def paired_values(
        cls, records: List[Dict[str, Any]], key_a: str, key_b: str
    ) -> Tuple[List[float], List[float]]:
        """Values of two metrics taken only from records where both are present."""
        series_a: List[float] = []
        series_b: List[float] = []
        for r in records:
            a, b = r.get(key_a), r.get(key_b)
            if cls._is_number(a) and cls._is_number(b):
                series_a.append(float(a))
                series_b.append(float(b))
        return series_a, series_b

    @classmethod
    def extract_all_features(
        cls,
        records: List[Dict[str, Any]],
        expected_interval_seconds: Optional[float] = None,
        window_seconds: Optional[float] = None,
        rate_window_seconds: float = 3600.0,
        rate_min_samples: int = 3,
    ) -> Dict[str, Any]:
        """
        Builds per-metric statistics for every numeric key in the records.
        Data completeness is only computed when the expected reporting interval is known;
        the window defaults to the span between the first and last record.
        Records without a usable timestamp are excluded, since every check here is time-based.
        """
        timed: List[Tuple[float, Dict[str, Any]]] = []
        for record in records or []:
            ts = cls.get_record_timestamp(record)
            if ts is not None:
                timed.append((ts, record))

        if not timed:
            return {
                "record_count": 0,
                "records_without_timestamp": len(records or []),
                "duration_hours": 0.0,
                "expected_records": None,
                "missing_rate": None,
                "metrics": {},
            }

        timed.sort(key=lambda pair: pair[0])
        timestamps = [pair[0] for pair in timed]
        sorted_records = [pair[1] for pair in timed]

        series_by_key: Dict[str, List[Tuple[float, float]]] = {}
        for r, r_ts in zip(sorted_records, timestamps):
            for k, v in r.items():
                if k in _NON_METRIC_KEYS or not cls._is_number(v):
                    continue
                series_by_key.setdefault(k, []).append((float(v), r_ts))

        span_seconds = max(0.0, timestamps[-1] - timestamps[0])
        feature_map: Dict[str, Any] = {
            "record_count": len(sorted_records),
            "records_without_timestamp": len(records) - len(sorted_records),
            "duration_hours": round(span_seconds / 3600.0, 2),
            "expected_records": None,
            "missing_rate": None,
            "metrics": {},
        }

        if expected_interval_seconds and expected_interval_seconds > 0:
            if window_seconds:
                expected = max(1, int(window_seconds // expected_interval_seconds))
            else:
                expected = max(1, int(span_seconds // expected_interval_seconds) + 1)
            feature_map["expected_records"] = expected
            feature_map["missing_rate"] = cls.calculate_missing_rate(len(sorted_records), expected)

        for key, pairs in series_by_key.items():
            vals = [p[0] for p in pairs]
            ts_list = [p[1] for p in pairs]
            max_rise, max_fall = cls.calculate_max_rates_per_hour(
                vals, ts_list, window_seconds=rate_window_seconds, min_samples=rate_min_samples
            )
            feature_map["metrics"][key] = {
                **cls.calculate_variance_and_spikes(vals),
                "gradient_per_hour": cls.calculate_discharge_gradient(vals, ts_list),
                "max_rise_per_hour": max_rise,
                "max_fall_per_hour": max_fall,
                "max_rate_per_hour": max(max_rise, max_fall),
                "max_rate_signed": max_rise if max_rise >= max_fall else -max_fall,
                "count": len(vals),
                "values": vals,
                "timestamps": ts_list,
            }

        return feature_map
