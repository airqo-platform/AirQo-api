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
    if response.status_code == 200:
        print("Check complete. Some issues were detected, check our slack channel")
    else:
        print("Check complete. Some issues were detected though we weren't able to send a slack message")

    print(response.content)


def build_message(url, status_code, request_type, response_body):
    return dict({
            "text": f"*Status Code*: {status_code}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Url*: {url}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Request Type*: {request_type}"
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Response Body*: {str(response_body)}"
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Time check was carried out*: {datetime.utcnow().strftime('%Y-%m-%d %H:%M ')} UTC"
                    },
                },
            ]
        })


def run_checks():

    api_url = f"{DEVICE_REGISTRY_BASE_URL}devices/events?tenant={TENANT}"

    results = requests.get(api_url)

    if results.status_code != 200:
        data = build_message(api_url, results.status_code, results.request.method, str(results.content))
        notify_slack(data)
        return

    response_data = results.json()
    measurements = list(response_data["measurements"])

    if len(measurements) == 0:
        data = build_message(api_url, results.status_code, results.request.method, response_data)
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
        data = build_message(api_url, results.status_code,
                             results.request.method, "It's better you make the query yourself")
        notify_slack(data)
        return

    print("Check complete. All looks fine")


if __name__ == '__main__':
    run_checks()
