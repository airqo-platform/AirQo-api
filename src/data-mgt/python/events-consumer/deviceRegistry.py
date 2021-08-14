import json
import os

import requests

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"
CALIBRATE = os.getenv("CALIBRATE")


class DeviceRegistry:
    def __init__(self, tenant, url) -> None:
        self.tenant = tenant
        self.base_url = url
        self.calibrate_url = f"{self.base_url}calibrate"

    def insert_events(self, data):

        data_dict = list(data)
        measurements = []
        for row in data_dict:
            row_dict = dict(row)

            if f"{CALIBRATE}".strip().lower() == "true":
                time = row_dict.get("time")
                device = row_dict.get("device")
                pm2_5 = dict(row_dict.get("pm2_5")).get("value")
                pm10 = dict(row_dict.get("pm10")).get("value")
                temp = dict(row_dict.get("externalTemperature")).get("value")
                hum = dict(row_dict.get("externalHumidity")).get("value")

                row_dict["pm2_5"]["calibratedValue"] = self.get_calibrated_value(
                    device=device,
                    time=time,
                    humidity=hum,
                    pm2_5=pm2_5,
                    pm10=pm10,
                    temperature=temp
                )

            measurements.append(row_dict)

        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events/add?tenant=" + self.tenant
            json_data = json.dumps(measurements)

            results = requests.post(url, json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print("Device registry failed to insert values. Status Code : " + str(results.status_code))
                print(results.content)

        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))

    def get_calibrated_value(self, device, time, pm2_5, pm10, temperature, humidity):
        print("getting calibrated value")

        data = {
            "datetime": time,
            "raw_values": [
                {
                    "device_id": device,
                    "pm2.5": pm2_5,
                    "pm10": pm10,
                    "temperature": temperature,
                    "humidity": humidity
                }
            ]
        }

        try:
            headers = {'Content-Type': 'application/json'}
            post_request = requests.post(url=self.calibrate_url, data=json.dumps(data), timeout=60000, headers=headers)
        except Exception as ex:
            print(f"Calibrate Url returned an error: {str(ex)}")
            return None

        if post_request.status_code != 200:
            print('\n')
            print(f"Calibrate failed to return values. Status Code : "
                  f"{str(post_request.status_code)}, Url : {self.calibrate_url}, Body: {data}")
            print(post_request.content)
            print('\n')
            return None

        try:
            response = post_request.json()

            calibrated_value = None
            for result in response:
                if "calibrated_value" in result:
                    calibrated_value = result["calibrated_value"]
                    break
            return calibrated_value

        except Exception as ex:
            print(f"Error processing calibrate response: {str(ex)}")
            return None
