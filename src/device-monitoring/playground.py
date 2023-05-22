from datetime import datetime, timedelta

import pandas as pd
import requests

if __name__ == "__main__":
    response = requests.get(
        "https://platform.airqo.net/api/v1/devices?tenant=airqo&network=airqo"
    ).json()
    devices = []
    for device in response["devices"]:
        active = device.get("isActive", False)
        if active:
            devices.append({"name": device["name"]})

    end_date_time = datetime.utcnow()
    start_date_time = end_date_time - timedelta(minutes=60)

    api_data = []

    for device in devices:
        url = (
            f"https://platform.airqo.net/api/v1/monitor/devices/uptime?"
            f"tenant=airqo&"
            f'startDate={datetime.strftime(start_date_time, "%Y-%m-%dT%H:%M:%S.%fZ")}&'
            f'endDate={datetime.strftime(end_date_time, "%Y-%m-%dT%H:%M:%S.%fZ")}&'
            f'device_name={device["name"]}'
        )

        print(url)

        response = requests.get(url).json()
        api_data.extend(response["data"])
        if len(api_data) > 5:
            break

    device_data = []
    for record in api_data:
        for value in record["values"]:
            device_data.append(
                {
                    "device": value["device_name"],
                    "time": value["created_at"],
                    "s1_pm2_5": value["sensor_one_pm2_5"],
                    "s2_pm2_5": value["sensor_two_pm2_5"],
                }
            )

    device_data = pd.DataFrame(device_data)
    cleaned_device_data = device_data.dropna(subset=["s2", "s1", "time"])
