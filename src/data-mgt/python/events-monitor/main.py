import json
import os
from datetime import datetime, timedelta

import requests

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_URL", "http://staging-platform.airqo.net/api/v1/")
TENANT = os.getenv("TENANT", "airqo")
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK", "")
TIME_INTERVAL = os.getenv("TIME_INTERVAL", 3)


def notify_slack(data):
    data = json.dumps(data)
    headers = {'Content-Type': 'application/json'}
    response = requests.post(SLACK_WEBHOOK, data=data, headers=headers)
    print(response.content)


def run_checks():

    api_url = f"{DEVICE_REGISTRY_BASE_URL}devices/events?tenant={TENANT}"

    results = requests.get(api_url)

    if results.status_code != 200:
        data = dict({
            "text": f"Device registry returned {results.status_code} status code",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Url : {api_url}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Time check was carried out : *{datetime.now()}*"
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Response : {str(results.content)}"
                    },
                },
            ]
        })
        notify_slack(data)
        return

    response_data = results.json()
    measurements = list(response_data["measurements"])

    if len(measurements) == 0:
        data = dict({
            "text": f"Device registry returned 0 measurements",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Url : *{api_url}*"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Time check was carried out : *{datetime.now()}*"
                    },
                }
            ]
        })
        notify_slack(data)
        return

    has_latest = False
    check_date = datetime.utcnow() - timedelta(hours=TIME_INTERVAL)

    for measurement in measurements:
        measurement_values = dict(measurement)
        measurement_date = datetime.strptime(measurement_values["time"], '%Y-%m-%dT%H:%M:%S.%fZ')
        if measurement_date > check_date:
            has_latest = True
            break

    if not has_latest:
        data = dict({
            "text": f"Device registry doesnt have latest measurements",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Url : *{api_url}*"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Interval : *{TIME_INTERVAL}*"
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"Time check was carried out : *{datetime.now()}*"
                    },
                }
            ]
        })
        notify_slack(data)
        return

    print("Check passed")


if __name__ == '__main__':
    run_checks()
