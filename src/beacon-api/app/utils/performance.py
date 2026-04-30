from typing import List, Dict, Any, Tuple
from datetime import datetime

class PerformanceAnalysis:
    def __init__(self, data: List[Dict[str, Any]], expected_frequency_minutes: int = 2):
        self.data = data
        self.expected_frequency_minutes = expected_frequency_minutes

    def _calculate_expected_records(self, start_date_time: str, end_date_time: str) -> int:
        try:
            # Handle typical 'Z' ending or parse from ISO format
            start_dt = datetime.fromisoformat(start_date_time.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_date_time.replace('Z', '+00:00'))
            duration_minutes = (end_dt - start_dt).total_seconds() / 60.0
            # Can't have less than 0 expected
            return max(1, int(duration_minutes / self.expected_frequency_minutes))
        except Exception:
            # Fallback if parsing fails
            return 1

    def _calculate_correlation(self, x: List[float], y: List[float]) -> float:
        """
        Calculate Pearson correlation coefficient.
        """
        n = len(x)
        if n < 2:
            return 0.0
        
        sum_x = sum(x)
        sum_y = sum(y)
        sum_x_sq = sum(i * i for i in x)
        sum_y_sq = sum(i * i for i in y)
        sum_xy = sum(i * j for i, j in zip(x, y))
        
        numerator = n * sum_xy - sum_x * sum_y
        term_x = n * sum_x_sq - sum_x**2
        term_y = n * sum_y_sq - sum_y**2
        
        # Avoid negative results from precision issues before taking square root
        denominator = (max(0, term_x) * max(0, term_y))**0.5
        
        if denominator == 0:
            return 0.0
            
        return numerator / denominator

    @staticmethod
    def _group_by_device(data: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group raw records by `device_name`, skipping records without one."""
        device_data: Dict[str, List[Dict[str, Any]]] = {}
        for record in data:
            dev_name = record.get("device_name")
            if not dev_name:
                continue
            device_data.setdefault(dev_name, []).append(record)
        return device_data

    @staticmethod
    def _avg_or_none(values: List[float]):
        return (sum(values) / len(values)) if values else None

    @staticmethod
    def _avg_or_zero(values: List[float]) -> float:
        return (sum(values) / len(values)) if values else 0.0

    @staticmethod
    def _extract_hour(dt_str: Any):
        """Parse an ISO datetime string and return its hour, or None on failure."""
        if not dt_str:
            return None
        try:
            return datetime.fromisoformat(str(dt_str).replace("Z", "+00:00")).hour
        except Exception:
            return None

    def _bam_metrics(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute BAM-style metrics for a single device's records."""
        unique_hours: set = set()
        realtime_concs: List[float] = []
        short_time_concs: List[float] = []
        hourly_concs: List[float] = []
        complete_records = 0

        for r in records:
            hour = self._extract_hour(r.get("datetime"))
            if hour is not None:
                unique_hours.add(hour)

            rt = r.get("realtime_conc")
            st = r.get("short_time_conc")
            hc = r.get("hourly_conc")
            if rt is not None or st is not None or hc is not None:
                complete_records += 1
            if rt is not None:
                realtime_concs.append(rt)
            if st is not None:
                short_time_concs.append(st)
            if hc is not None:
                hourly_concs.append(hc)

        total = len(records)
        return {
            "uptime": len(unique_hours) / 24.0,
            "data_completeness": (complete_records / total) if total > 0 else 0.0,
            "realtime_conc_average": self._avg_or_none(realtime_concs),
            "short_time_conc_average": self._avg_or_none(short_time_concs),
            "hourly_conc_average": self._avg_or_none(hourly_concs),
        }

    @staticmethod
    def _accumulate_lowcost_record(
        r: Dict[str, Any],
        s1_values: List[float],
        s2_values: List[float],
        error_margins: List[float],
        paired_s1: List[float],
        paired_s2: List[float],
    ) -> bool:
        """
        Update the running aggregates for one lowcost record. Returns True if
        the record contributed to data-completeness (any pm2_5 reading present).
        """
        pm2_5 = r.get("pm2_5")
        s1 = r.get("s1_pm2_5")
        s2 = r.get("s2_pm2_5")
        is_complete = pm2_5 is not None or s1 is not None or s2 is not None

        if s1 is not None and s2 is not None:
            error_margins.append(abs(s1 - s2))
            s1_values.append(s1)
            s2_values.append(s2)
            paired_s1.append(s1)
            paired_s2.append(s2)
        elif s1 is not None:
            s1_values.append(s1)
        elif s2 is not None:
            s2_values.append(s2)

        return is_complete

    def _lowcost_metrics(
        self, records: List[Dict[str, Any]], expected_records: int,
    ) -> Dict[str, Any]:
        """Compute lowcost-style metrics for a single device's records."""
        error_margins: List[float] = []
        s1_values: List[float] = []
        s2_values: List[float] = []
        paired_s1: List[float] = []
        paired_s2: List[float] = []
        complete_records = 0

        for r in records:
            if self._accumulate_lowcost_record(
                r, s1_values, s2_values, error_margins, paired_s1, paired_s2,
            ):
                complete_records += 1

        total = len(records)
        return {
            "uptime": min(1.0, total / expected_records) if expected_records else 0.0,
            "data_completeness": (complete_records / total) if total > 0 else 0.0,
            "sensor_error_margin": self._avg_or_zero(error_margins),
            "s1_pm2_5_average": self._avg_or_zero(s1_values),
            "s2_pm2_5_average": self._avg_or_zero(s2_values),
            "correlation": self._calculate_correlation(paired_s1, paired_s2),
        }

    def compute_device_metrics(self, start_date_time: str, end_date_time: str, device_category: str = "lowcost") -> Dict[str, Dict[str, float]]:
        """
        Group data by device_name and calculate performance metrics:
        - uptime
        - data_completeness
        - sensor_error_margin (for lowcost)
        - concentrations averages (for bam)

        Returns a dict mapping device_name to a dict of metrics.
        """
        expected_records = self._calculate_expected_records(start_date_time, end_date_time)
        device_data = self._group_by_device(self.data)
        is_bam = device_category == "bam"

        metrics: Dict[str, Dict[str, float]] = {}
        for dev_name, records in device_data.items():
            metrics[dev_name] = (
                self._bam_metrics(records) if is_bam
                else self._lowcost_metrics(records, expected_records)
            )
        return metrics

    def compute_cohort_metrics(self, device_metrics: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """
        Takes the device-level metrics mapping and computes average cohort-level metrics.
        """
        if not device_metrics:
            return {
                "uptime": 0.0,
                "data_completeness": 0.0,
                "sensor_error_margin": 0.0,
                "s1_pm2_5_average": 0.0,
                "s2_pm2_5_average": 0.0,
                "correlation": 0.0
            }

        total_uptime = 0.0
        total_completeness = 0.0
        total_error_margin = 0.0
        total_s1_avg = 0.0
        total_s2_avg = 0.0
        total_correlation = 0.0
        device_count = len(device_metrics)

        for dev, m in device_metrics.items():
            total_uptime += m.get("uptime", 0.0)
            total_completeness += m.get("data_completeness", 0.0)
            total_error_margin += m.get("sensor_error_margin", 0.0)
            total_s1_avg += m.get("s1_pm2_5_average", 0.0)
            total_s2_avg += m.get("s2_pm2_5_average", 0.0)
            total_correlation += m.get("correlation", 0.0)

        return {
            "uptime": total_uptime / device_count,
            "data_completeness": total_completeness / device_count,
            "sensor_error_margin": total_error_margin / device_count,
            "s1_pm2_5_average": total_s1_avg / device_count,
            "s2_pm2_5_average": total_s2_avg / device_count,
            "correlation": total_correlation / device_count
        }
