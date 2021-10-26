import json
from datetime import datetime, timedelta

import requests

from utils import build_slack_message


class Events:
    def __init__(self, airqo_base_url, webhook, tenant) -> None:
        self.airqo_base_url = airqo_base_url
        self.webhook = webhook
        self.tenant = tenant
        super().__init__()

    def check_api(self):

        api_url = f"{self.airqo_base_url}devices?tenant={self.tenant}"

        results = requests.get(api_url)

        if results.status_code != 200:
            msg = build_slack_message(api_url, results.status_code, results.request.method, str(results.content),
                                      f"Get devices endpoint for {self.tenant.capitalize()} "
                                      f"returns a none 200 status code. Find details below")
            self.notify_slack(msg)
            return False

        return True

    def check_measurements(self, hours, frequency):

        api_url = f"{self.airqo_base_url}devices/events?tenant={self.tenant}&recent=yes&frequency={frequency}"

        results = requests.get(api_url)

        if results.status_code != 200:
            msg = build_slack_message(api_url, results.status_code, results.request.method, str(results.content),
                                      f"{str(frequency).title()} events endpoint for {self.tenant.capitalize()} "
                                      f"returns a none 200 status code. Find details below")
            self.notify_slack(msg)
            return

        response_data = results.json()
        measurements = list(response_data["measurements"])

        if len(measurements) == 0:
            msg = build_slack_message(api_url, results.status_code, results.request.method, response_data,
                                      f"{str(frequency).title()} events endpoint for {self.tenant.capitalize()} "
                                      f"returns an empty array of measurements. 🤔 🤔")
            self.notify_slack(msg)
            return

        has_latest = False
        check_date = datetime.utcnow() - timedelta(hours=int(hours))

        for measurement in measurements:
            measurement_values = dict(measurement)
            measurement_date = datetime.strptime(measurement_values["time"], '%Y-%m-%dT%H:%M:%S.%fZ')
            if measurement_date > check_date:
                has_latest = True
                break

        if not has_latest:
            msg = build_slack_message(api_url, results.status_code, results.request.method,
                                      "'The response body is too large, its better you make the query using a browser "
                                      "or postman and review the *time* field'",
                                      f"{self.tenant.capitalize()} {frequency} measurements "
                                      f"recorded {hours} hour(s) "
                                      f"ago are missing. :man-shrugging:")
            self.notify_slack(msg)
            return

        print(f"Check complete. All looks fine for {self.tenant} {frequency} events")

    def notify_slack(self, data):
        data = json.dumps(data)
        headers = {'Content-Type': 'application/json'}
        response = requests.post(self.webhook, data=data, headers=headers)
        if response.status_code == 200:
            print("Check complete. Some issues were detected, check our slack channel")
        else:
            print("Check complete. Some issues were detected though we weren't able to send a slack message")

        print(response.content)
