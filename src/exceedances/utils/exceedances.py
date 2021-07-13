from datetime import datetime
from dateutil.tz import UTC
from dateutil.relativedelta import relativedelta
from models import Event, Exceedance


class CalculateExceedances:

    def __init__(self, tenant):
        self.tenant = tenant
        self.WHO_LIMIT = {"pm2_5": 25, "pm10": 50, "no2": 40}
        self.events = self.get_events()
        self.PM_25_AQI_LIMIT = {
            'Good': [0, 12],
            'Moderate': [12, 35.4],
            'UHFSG': [35.4, 55.4],
            'Unhealthy': [55.4, 150.4],
            'VeryUnhealthy': [150.4, 250.4],
            'Hazardous': [250.4, 500.4],
        }
        self.PM_10_AQI_LIMIT = {
            'Good': [0, 54],
            'Moderate': [54, 154],
            'UHFSG': [154, 254],
            'Unhealthy': [254, 354],
            'VeryUnhealthy': [354, 424],
            'Hazardous': [424, 604],
        }
        self.NO2_AQI_LIMIT = {
            'Good': [0, 53],
            'Moderate': [53, 100],
            'UHFSG': [100, 360],
            'Unhealthy': [360, 649],
            'VeryUnhealthy': [649, 1249],
            'Hazardous': [1249, 2049],
        }

    def calculate_WHO_exceedance(self, events):
        exceednace_pm2_5, exceedance_pm10, exceedance_no2 = 0, 0, 0

        for event in events:
            exceednace_pm2_5 += float(event.get("pm2_5") or -1) > self.WHO_LIMIT.get("pm2_5") and 1 or 0
            exceedance_pm10 += float(event.get("pm10") or -1) > self.WHO_LIMIT.get("pm10") and 1 or 0
            exceedance_no2 += float(event.get("no2") or -1) > self.WHO_LIMIT.get("no2") and 1 or 0

        return {
            "pm2_5": exceednace_pm2_5,
            "pm10": exceedance_pm10,
            "no2": exceedance_no2,
            "total": len(events)
        }

    def calculate_aqi_exceedance(self, events):
        pm2_5 = {
            'Good': 0,
            'Moderate': 0,
            'UHFSG': 0,
            'Unhealthy': 0,
            'VeryUnhealthy': 0,
            'Hazardous': 0,
        }
        pm10 = {
            'Good': 0,
            'Moderate': 0,
            'UHFSG': 0,
            'Unhealthy': 0,
            'VeryUnhealthy': 0,
            'Hazardous': 0,
        }
        no2 = {
            'Good': 0,
            'Moderate': 0,
            'UHFSG': 0,
            'Unhealthy': 0,
            'VeryUnhealthy': 0,
            'Hazardous': 0,
        }

        for event in events:
            for key, [min_value, max_value] in self.PM_25_AQI_LIMIT.items():
                if min_value < float(event.get("pm2_5") or -1) <= max_value:
                    pm2_5[key] = pm2_5.get(key, 0) + 1
                    break

            for key, [min_value, max_value] in self.PM_10_AQI_LIMIT.items():
                if min_value < float(event.get("pm10") or -1) <= max_value:
                    pm10[key] = pm10.get(key, 0) + 1
                    break

            for key, [min_value, max_value] in self.NO2_AQI_LIMIT.items():
                if min_value < float(event.get("no2") or -1) <= max_value:
                    no2[key] = no2.get(key, 0) + 1
                    break

        return {
            "pm2_5": pm2_5,
            "pm10": pm10,
            "no2": no2,
            "total": len(events)
        }

    def calculate_exceedances(self):
        """
        get the measurements for all sites accordingly
        Using a loop, calculate each Site's exceedance accordingly
        return the exceedance list for all sites accordingly
        """
        created_at = datetime.utcnow()
        created_at = created_at.replace(tzinfo=UTC)
        grouped_events = self.events
        exceedances = []

        for site_events in grouped_events:
            WHO = self.calculate_WHO_exceedance(site_events["reading"])
            aqi = self.calculate_aqi_exceedance(site_events["reading"])

            exceedances.append({
                "site_id": site_events["_id"],
                "time": created_at.isoformat(),
                "who": WHO,
                "aqi": aqi,
            })

        return exceedances

    def save_exceedances(self, exceedances):
        created_at = datetime.utcnow()
        created_at = created_at.replace(tzinfo=UTC)
        exceedance_model = Exceedance(self.tenant)
        record = {"day": created_at.isoformat(), "exceedances": exceedances}
        return exceedance_model.save_exceedance(record)

    def get_events(self):
        end_date = datetime.utcnow()
        start_date = end_date - relativedelta(days=1)
        event_model = Event(self.tenant)

        return list(event_model.get_events(start_date, end_date))
