import json
import os
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv

load_dotenv()

AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL")
TENANT = os.getenv("TENANT")
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK")
HOURS = os.getenv("HOURS")
MINUTES = os.getenv("MINUTES")


def notify_slack(data):
    data = json.dumps(data)
    headers = {'Content-Type': 'application/json'}
    response = requests.post(SLACK_WEBHOOK, data=data, headers=headers)
    if response.status_code == 200:
        print("Check complete. Some issues were detected, check our slack channel")
    else:
        print("Check complete. Some issues were detected though we weren't able to send a slack message")

    print(response.content)


def build_message(url, status_code, request_type, response_body, message):
    return dict({
            "text": {
                "type": "mrkdwn",
                "text": f"@channel, {message}"
            },
            "attachments": [
            {
                "fallback": f"{message}",
                "color": "#3067e2",
                "title": f"{message}",
                "fields": [
                    {
                        "title": "Url",
                        "value": f"{url}",
                    },
                    {
                        "title": "Request Type",
                        "value": f"{request_type}",
                    },
                    {
                        "title": "Response Status Code",
                        "value": f"{status_code}",
                    },
                    {
                        "title": "Response Body",
                        "color": "#3067e2",
                        "type": "mrkdwn",
                        "value": f"{str(response_body)}",
                    }
                ],
                "footer": "AirQo APIs",
            }
        ]
        })


def run_checks():

    api_url = f"{AIRQO_BASE_URL}devices/events?tenant={TENANT}&recent=yes"

    results = requests.get(api_url)

    if results.status_code != 200:
        data = build_message(api_url, results.status_code, results.request.method, str(results.content),
                             f"Get events endpoint for {TENANT.capitalize()} returns a none 200 status code. Find details below")
        notify_slack(data)
        return

    response_data = results.json()
    measurements = list(response_data["measurements"])

    if len(measurements) == 0:
        data = build_message(api_url, results.status_code, results.request.method, response_data,
                             f"Get events endpoint for {TENANT.capitalize()} returns an empty array of measurements. 🤔 🤔")
        notify_slack(data)
        return

    has_latest = False
    check_date = datetime.utcnow() - timedelta(hours=int(HOURS), minutes=int(MINUTES))

    for measurement in measurements:
        measurement_values = dict(measurement)
        measurement_date = datetime.strptime(measurement_values["time"], '%Y-%m-%dT%H:%M:%S.%fZ')
        if measurement_date > check_date:
            has_latest = True
            break

    if not has_latest:
        data = build_message(api_url, results.status_code, results.request.method,
                             "'The response body is too large, its better you make the query using a browser or postman and review the *time* field'",
                             f"{TENANT.capitalize()} measurements that were recorded {HOURS} hour(s), {MINUTES} minute(s) ago are missing. :man-shrugging:")
        notify_slack(data)
        return

    print("Check complete. All looks fine")


if __name__ == '__main__':
    run_checks()
