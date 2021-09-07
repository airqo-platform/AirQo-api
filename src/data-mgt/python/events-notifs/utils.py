import traceback

import requests
import urllib3
from firebase_admin import messaging

from config import configuration

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def compose_notification_message(pm2_5, site_name):
    if 0.00 <= pm2_5 <= 12.09:
        return f'Air Quality in {site_name} is good'
    elif 12.10 <= pm2_5 <= 35.49:
        return f'Air Quality in {site_name} is moderate'
    if 35.50 <= pm2_5 <= 55.49:
        return f'Air Quality in {site_name} is unhealthy for sensitive groups of people'
    elif 55.50 <= pm2_5 <= 150.49:
        return f'Air Quality in {site_name} is unhealthy'
    elif 150.50 <= pm2_5 <= 250.49:
        return f'Air Quality in {site_name} is very unhealthy'
    elif 250.50 <= pm2_5 <= 500.40:
        return f'Air Quality in {site_name} is hazardous'
    else:
        return None


def get_topic(pm2_5, site_id):
    if 0.00 <= pm2_5 <= 12.09:
        return f'{site_id}-good'.strip().lower()
    elif 12.10 <= pm2_5 <= 35.49:
        return f'{site_id}-moderate'.strip().lower()
    if 35.50 <= pm2_5 <= 55.49:
        return f'{site_id}-sensitive'.strip().lower()
    elif 55.50 <= pm2_5 <= 150.49:
        return f'{site_id}-unhealthy'.strip().lower()
    elif 150.50 <= pm2_5 <= 250.49:
        return f'{site_id}-very-unhealthy'.strip().lower()
    elif 250.50 <= pm2_5 <= 500.40:
        return f'{site_id}-hazardous'.strip().lower()
    else:
        return None


def send_alerts(alerts):
    for alert in alerts:
        try:
            alert_data = dict(alert)
            topic = alert_data.get("topic")

            message = messaging.Message(
                data={
                    'message': alert_data.get("message"),
                    'site_id': alert_data.get("site_id"),
                },
                topic=topic,
            )

            print(message)
            response = messaging.send(message)
            print('Successfully sent message:', response)

        except:
            traceback.print_exc()


class AirQoApi:
    def __init__(self):
        self.airqo_base_url = configuration.AIRQO_BASE_URL
        self.airqo_api_key = f"JWT {configuration.AIRQO_API_KEY}"

    def get_events(self, tenant, start_time, end_time, site_id):
        headers = {'Authorization': f'JWT {self.airqo_api_key}'}

        params = {
            "tenant": tenant,
            "frequency": 'raw',
            "site_id": site_id,
            "metadata": "site_id",
            "startTime": start_time,
            "endTime": end_time
        }

        try:
            api_request = requests.get(
                '%s%s' % (self.airqo_base_url, 'devices/events'),
                params=params,
                headers=headers,
                verify=False
            )

            if api_request.status_code == 200 and "measurements" in api_request.json():
                return api_request.json()["measurements"]

            print(api_request.request.url)
            print(api_request.request.body)
            print(api_request.content)
            return []
        except:
            traceback.print_exc()
            return []

    def get_sites(self, tenant):
        headers = {'Authorization': f'JWT {self.airqo_api_key}'}

        params = {
            "tenant": tenant,
        }

        try:
            api_request = requests.get(
                '%s%s' % (self.airqo_base_url, 'devices/sites'),
                params=params,
                headers=headers,
                verify=False
            )

            if api_request.status_code == 200 and "sites" in api_request.json():
                return api_request.json()["sites"]

            print(api_request.request.url)
            print(api_request.request.body)
            print(api_request.content)
            return []
        except:
            traceback.print_exc()
            return []
