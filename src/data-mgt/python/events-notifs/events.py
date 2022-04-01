import traceback
from datetime import datetime, timedelta

import firebase_admin
import pandas as pd
from firebase_admin import credentials, messaging
from firebase_admin import firestore

from config import configuration
from utils import AirQoApi, compose_notification_message, pm_to_string


class EventsNotifications:

    def __init__(self):
        self.airqo_api = AirQoApi()
        self.hours = int(configuration.HOURS)
        self.subscribers = []
        self.alerts = []
        self.events = []
        cred = credentials.Certificate(configuration.SERVICE_ACCOUNT)
        firebase_admin.initialize_app(cred)

        self.db = firestore.client()

    def send_alerts(self):

        for alert in self.alerts:
            registration_token = alert['receiver']
            message = messaging.Message(
                data={
                    'title': 'AirQo',
                    'body': alert['message'],
                },
                token=registration_token,
            )
            response = messaging.send(message)
            print('Successfully sent message:', response)

    def send_notifications(self):

        self.get_subscribers()
        if self.subscribers:

            self.get_measurements()
            if self.events:

                events_df = pd.DataFrame(self.events)
                now_hours = datetime.utcnow().hour
                for subscriber in self.subscribers:

                    event = events_df.loc[events_df['siteId'] == subscriber["siteId"]]

                    if not event.empty:

                        pm2_5 = float(event.iloc[0]['pm2_5'])
                        site_name = event.iloc[0]['siteName']

                        if subscriber["type"] == "custom" and pm_to_string(pm2_5) == subscriber["airQuality"]:
                            self.alerts.append({
                                "receiver": subscriber["receiver"],
                                "message": compose_notification_message(pm2_5, site_name)
                            })

                        elif subscriber["type"] == "fixeddaily" and now_hours == int(subscriber["hour"]):
                            self.alerts.append({
                                "receiver": subscriber["receiver"],
                                "message": compose_notification_message(pm2_5, site_name)
                            })

                        else:
                            continue

        self.send_alerts()

    def get_subscribers(self):
        subscribers_ref = self.db.collection(configuration.EVENTS_ALERTS_COLLECTION)
        docs = subscribers_ref.stream()

        for doc in docs:
            self.subscribers.append(doc.to_dict())

    def get_measurements(self):
        time = datetime.utcnow()
        start_time = (time - timedelta(hours=self.hours)).strftime('%Y-%m-%dT%H:00:00Z')
        end_time = (datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') + timedelta(hours=self.hours)) \
            .strftime('%Y-%m-%dT%H:00:00Z')

        print(f'UTC start time : {start_time}')
        print(f'UTC end time : {end_time}')

        events = self.airqo_api.get_events(tenant=configuration.TENANT, start_time=start_time,
                                           end_time=end_time, frequency="hourly", metadata="site_id")

        events_df = pd.DataFrame(events)

        if events_df.empty:
            print("data frame is empty")
            return []

        for _, event in events_df.iterrows():
            try:

                readings = event.to_dict()
                time = readings['time']
                site_id = readings['site_id']
                pm2_5 = readings['average_pm2_5']['calibratedValue']

                if readings['siteDetails']['description'] != '':
                    site_name = f"{readings['siteDetails']['description']}"
                else:
                    site_name = f"{readings['siteDetails']['name']}"

                self.events.append({
                    "siteName": site_name,
                    "siteId": site_id,
                    "pm2_5": pm2_5,
                    "time": time
                })

            except:
                traceback.print_exc()
