import traceback
from datetime import datetime, timedelta

import pandas as pd

from config import configuration
from utils import AirQoApi, send_alerts, get_topic, compose_notification_message


class EventsJob:

    def __init__(self):
        self.airqo_api = AirQoApi()
        self.hours = int(configuration.HOURS)

    def average_and_send_alerts(self):
        time = datetime.utcnow()
        start_time = (time - timedelta(hours=self.hours)).strftime('%Y-%m-%dT%H:00:00Z')
        end_time = (datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') + timedelta(hours=self.hours)) \
            .strftime('%Y-%m-%dT%H:00:00Z')

        print(f'UTC start time : {start_time}')
        print(f'UTC end time : {end_time}')

        devices = self.airqo_api.get_sites(tenant='airqo')
        sites_df = pd.DataFrame(devices)

        if sites_df.count == 0:
            print("sites empty")
            return

        alerts = []
        raw_measurements = []

        for _, site in sites_df.iterrows():

            if '_id' not in site.keys():
                print(f'site_id missing in site keys : {site.keys()}')
                continue

            site_id = site['_id']
            device_measurements = self.airqo_api.get_events(tenant=configuration.TENANT, start_time=start_time,
                                                            end_time=end_time, site_id=site_id)

            if not device_measurements:
                print(f"No measurements for site {site_id} : startTime {start_time} : endTime : {end_time}")
                continue

            raw_measurements.extend(device_measurements)

        raw_measurements_df = pd.DataFrame(raw_measurements)

        sites_events_groups = raw_measurements_df.groupby('site_id')
        for _, site_events in sites_events_groups:
            alert = dict()

            try:

                measurements = pd.json_normalize(site_events.to_dict(orient='records'))
                measurements['time'] = pd.to_datetime(measurements['time'])
                measurements.set_index('time')

                site_id = measurements.iloc[0]['site_id']
                if measurements.iloc[0]['siteDetails.description'] != '':
                    site_name = f"{measurements.iloc[0]['siteDetails.description']}"
                else:
                    site_name = f"{measurements.iloc[0]['siteDetails.name']}"

                averages = measurements.resample('1H', on='time').mean().round(2)

                averages = averages[averages['pm2_5.value'].notna()]
                averages = averages[averages['s2_pm2_5.value'].notna()]

                averages["average_pm2_5.value"] = averages[['pm2_5.value', 's2_pm2_5.value']].mean(axis=1).round(2)

                pm2_5 = averages.iloc[0]['average_pm2_5.value']

                alert['topic'] = get_topic(site_id=site_id, pm2_5=pm2_5)
                alert['site_id'] = site_id
                alert['message'] = compose_notification_message(pm2_5=pm2_5, site_name=site_name)

                if alert['topic'] is not None and alert['message'] is not None and alert['site_id'] is not None:
                    alerts.append(alert)

            except:
                traceback.print_exc()

        if alerts:
            send_alerts(alerts=alerts)
