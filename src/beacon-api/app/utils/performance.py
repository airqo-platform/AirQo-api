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

    def compute_device_metrics(self, startDateTime: str, endDateTime: str, device_category: str = "lowcost") -> Dict[str, Dict[str, float]]:
        """
        Group data by device_name and calculate performance metrics:
        - uptime
        - data_completeness
        - sensor_error_margin (for lowcost)
        - concentrations averages (for bam)
        
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

            complete_records = 0

            if device_category == "bam":
                # BAM uptime = unique hours that have at least one entry / 24
                unique_hours = set()
                realtime_concs = []
                short_time_concs = []
                hourly_concs = []
                for r in records:
                    # Extract the hour from the datetime field
                    dt_str = r.get("datetime")
                    if dt_str:
                        try:
                            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                            unique_hours.add((dt.date(), dt.hour))
                        except Exception:
                            pass

                    rt = r.get("realtime_conc")
                    st = r.get("short_time_conc")
                    hc = r.get("hourly_conc")
                    if rt is not None or st is not None or hc is not None:
                        complete_records += 1
                    if rt is not None: realtime_concs.append(rt)
                    if st is not None: short_time_concs.append(st)
                    if hc is not None: hourly_concs.append(hc)

                try:
                    start_dt = datetime.fromisoformat(startDateTime.replace("Z", "+00:00"))
                    end_dt = datetime.fromisoformat(endDateTime.replace("Z", "+00:00"))
                    total_hours = (end_dt - start_dt).total_seconds() / 3600.0
                    if total_hours <= 0:
                        total_hours = 24.0 # Fallback
                except Exception:
                    total_hours = 24.0

                uptime = len(unique_hours) / total_hours
                data_completeness = (complete_records / total_records) if total_records > 0 else 0.0
                metrics[dev_name] = {
                    "uptime": uptime,
                    "data_completeness": data_completeness,
                    "realtime_conc_average": (sum(realtime_concs) / len(realtime_concs)) if realtime_concs else None,
                    "short_time_conc_average": (sum(short_time_concs) / len(short_time_concs)) if short_time_concs else None,
                    "hourly_conc_average": (sum(hourly_concs) / len(hourly_concs)) if hourly_concs else None,
                }
            else:
                error_margins = []
                s1_values = []
                s2_values = []
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
                        s1_values.append(s1_pm2_5)
                        s2_values.append(s2_pm2_5)
                    elif s1_pm2_5 is not None:
                        s1_values.append(s1_pm2_5)
                    elif s2_pm2_5 is not None:
                        s2_values.append(s2_pm2_5)

                # Lowcost uptime = total records received / expected records for the period
                uptime = min(1.0, total_records / expected_records)
                data_completeness = (complete_records / total_records) if total_records > 0 else 0.0
                sensor_error_margin = (sum(error_margins) / len(error_margins)) if error_margins else 0.0
                
                s1_average = (sum(s1_values) / len(s1_values)) if s1_values else 0.0
                s2_average = (sum(s2_values) / len(s2_values)) if s2_values else 0.0
                
                # Correlation needs both s1 and s2 for each record. 
                # Re-extract pairs to ensure alignment.
                paired_s1 = []
                paired_s2 = []
                for r in records:
                    s1 = r.get("s1_pm2_5")
                    s2 = r.get("s2_pm2_5")
                    if s1 is not None and s2 is not None:
                        paired_s1.append(s1)
                        paired_s2.append(s2)
                
                correlation = self._calculate_correlation(paired_s1, paired_s2)

                metrics[dev_name] = {
                    "uptime": uptime,
                    "data_completeness": data_completeness,
                    "sensor_error_margin": sensor_error_margin,
                    "s1_pm2_5_average": s1_average,
                    "s2_pm2_5_average": s2_average,
                    "correlation": correlation
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
