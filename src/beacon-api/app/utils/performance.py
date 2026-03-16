from typing import List, Dict, Any, Tuple
from datetime import datetime

class PerformanceAnalysis:
    def __init__(self, data: List[Dict[str, Any]], expected_frequency_minutes: int = 2):
        self.data = data
        self.expected_frequency_minutes = expected_frequency_minutes

    def _calculate_expected_records(self, startDateTime: str, endDateTime: str) -> int:
        try:
            # Handle typical 'Z' ending or parse from ISO format
            start_dt = datetime.fromisoformat(startDateTime.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(endDateTime.replace('Z', '+00:00'))
            duration_minutes = (end_dt - start_dt).total_seconds() / 60.0
            # Can't have less than 0 expected
            return max(1, int(duration_minutes / self.expected_frequency_minutes))
        except Exception:
            # Fallback if parsing fails
            return 1

    def compute_device_metrics(self, startDateTime: str, endDateTime: str) -> Dict[str, Dict[str, float]]:
        """
        Group data by device_name and calculate performance metrics:
        - uptime
        - data_completeness
        - sensor_error_margin
        
        Returns a dict mapping device_name to a dict of metrics.
        """
        expected_records = self._calculate_expected_records(startDateTime, endDateTime)
        device_data: Dict[str, List[Dict[str, Any]]] = {}

        for record in self.data:
            dev_name = record.get("device_name")
            if not dev_name:
                continue
            if dev_name not in device_data:
                device_data[dev_name] = []
            device_data[dev_name].append(record)

        metrics = {}
        for dev_name, records in device_data.items():
            total_records = len(records)
            uptime = min(1.0, total_records / expected_records)

            complete_records = 0
            error_margins = []

            for r in records:
                pm2_5 = r.get("pm2_5")
                s1_pm2_5 = r.get("s1_pm2_5")
                s2_pm2_5 = r.get("s2_pm2_5")

                # Data completeness: Is there some valid pm2_5 measurement?
                if pm2_5 is not None or s1_pm2_5 is not None or s2_pm2_5 is not None:
                    complete_records += 1

                # Error margin: Absolute diff between s1 and s2
                if s1_pm2_5 is not None and s2_pm2_5 is not None:
                    error_margins.append(abs(s1_pm2_5 - s2_pm2_5))

            data_completeness = (complete_records / total_records) if total_records > 0 else 0.0
            sensor_error_margin = (sum(error_margins) / len(error_margins)) if error_margins else 0.0

            metrics[dev_name] = {
                "uptime": uptime,
                "data_completeness": data_completeness,
                "sensor_error_margin": sensor_error_margin
            }

        return metrics

    def compute_cohort_metrics(self, device_metrics: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """
        Takes the device-level metrics mapping and computes average cohort-level metrics.
        """
        if not device_metrics:
            return {
                "uptime": 0.0,
                "data_completeness": 0.0,
                "sensor_error_margin": 0.0
            }

        total_uptime = 0.0
        total_completeness = 0.0
        total_error_margin = 0.0
        device_count = len(device_metrics)

        for dev, m in device_metrics.items():
            total_uptime += m.get("uptime", 0.0)
            total_completeness += m.get("data_completeness", 0.0)
            total_error_margin += m.get("sensor_error_margin", 0.0)

        return {
            "uptime": total_uptime / device_count,
            "data_completeness": total_completeness / device_count,
            "sensor_error_margin": total_error_margin / device_count
        }
